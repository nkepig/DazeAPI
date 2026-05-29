package controller

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const paymentMethodEpay = "epay"

type EpayTopUpRequest struct {
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
}

func RequestEpayTopUp(c *gin.Context) {
	ps := operation_setting.GetPaymentSetting()
	if !epayConfigured(ps) {
		common.ApiErrorMsg(c, "易支付未配置")
		return
	}

	var req EpayTopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}

	money := math.Round(req.Amount*100) / 100
	minYuan := float64(operation_setting.MinTopUp)
	if money < minYuan {
		common.ApiErrorMsg(c, fmt.Sprintf("充值金额不能低于 %.2f 元", minYuan))
		return
	}

	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "用户未登录")
		return
	}

	payType := normalizeEpayPayType(req.Type, ps.EpayPayTypes)
	if payType == "" {
		common.ApiErrorMsg(c, "不支持的支付方式")
		return
	}

	tradeNo := fmt.Sprintf("EPAY%d%d", userId, common.GetTimestamp())
	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        int64(math.Round(money)),
		Money:         money,
		TradeNo:       tradeNo,
		PaymentMethod: paymentMethodEpay,
		Status:        common.TopUpStatusPending,
		CreateTime:    common.GetTimestamp(),
	}
	if err := topUp.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	payURL, err := buildEpayPayURL(ps, tradeNo, payType, money)
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		common.ApiErrorMsg(c, err.Error())
		return
	}

	common.ApiSuccess(c, gin.H{
		"trade_no": tradeNo,
		"pay_url":  payURL,
		"money":    money,
		"type":     payType,
	})
}

func EpayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	params := map[string]string{}
	for key, values := range c.Request.Form {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	if !verifyEpaySign(params, operation_setting.GetPaymentSetting().EpayKey) {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	if params["trade_status"] != "TRADE_SUCCESS" {
		c.String(http.StatusOK, "success")
		return
	}
	tradeNo := params["out_trade_no"]
	if tradeNo == "" {
		c.String(http.StatusOK, "success")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.Status != common.TopUpStatusPending || topUp.PaymentMethod != paymentMethodEpay {
		c.String(http.StatusOK, "success")
		return
	}
	quota := int64(topUp.Money * common.MicrodollarsPerUnit)
	if err := model.CompleteTopUp(topUp, quota); err != nil {
		common.SysError("epay topup failed: " + err.Error())
		c.String(http.StatusOK, "success")
		return
	}
	c.String(http.StatusOK, "success")
}

func EpayReturn(c *gin.Context) {
	c.Redirect(http.StatusFound, strings.TrimRight(system_setting.ServerAddress, "/")+"/console/topup?show_history=true")
}

func epayConfigured(ps *operation_setting.PaymentSetting) bool {
	return ps != nil && ps.EpayEnabled && strings.TrimSpace(ps.EpayApiUrl) != "" && strings.TrimSpace(ps.EpayPid) != "" && strings.TrimSpace(ps.EpayKey) != ""
}

func normalizeEpayPayType(payType string, allowed string) string {
	payType = strings.TrimSpace(payType)
	if payType == "" {
		parts := splitEpayPayTypes(allowed)
		if len(parts) == 0 {
			return "alipay"
		}
		return parts[0]
	}
	for _, item := range splitEpayPayTypes(allowed) {
		if item == payType {
			return payType
		}
	}
	return ""
}

func splitEpayPayTypes(raw string) []string {
	items := strings.Split(raw, ",")
	out := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
	}
	return out
}

func buildEpayPayURL(ps *operation_setting.PaymentSetting, tradeNo string, payType string, money float64) (string, error) {
	apiURL := strings.TrimRight(strings.TrimSpace(ps.EpayApiUrl), "/")
	if apiURL == "" {
		return "", fmt.Errorf("易支付网关地址未配置")
	}
	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/epay/notify"
	returnURL := strings.TrimRight(system_setting.ServerAddress, "/") + "/api/epay/return"
	params := map[string]string{
		"pid":          ps.EpayPid,
		"type":         payType,
		"out_trade_no": tradeNo,
		"notify_url":   notifyURL,
		"return_url":   returnURL,
		"name":         "额度充值",
		"money":        fmt.Sprintf("%.2f", money),
	}
	params["sign"] = epaySign(params, ps.EpayKey)
	params["sign_type"] = "MD5"
	values := url.Values{}
	for key, value := range params {
		values.Set(key, value)
	}
	submitURL := apiURL
	if !strings.HasSuffix(strings.ToLower(submitURL), ".php") {
		submitURL += "/submit.php"
	}
	return submitURL + "?" + values.Encode(), nil
}

func verifyEpaySign(params map[string]string, key string) bool {
	expected := strings.ToLower(params["sign"])
	if expected == "" {
		return false
	}
	return expected == epaySign(params, key)
}

func epaySign(params map[string]string, key string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || k == "sign_type" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + key))
	return hex.EncodeToString(sum[:])
}
