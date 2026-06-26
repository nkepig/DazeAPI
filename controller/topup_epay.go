package controller

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const paymentMethodEpay = "epay"

// 虎皮椒 (xunhupay) 协议常量
// 文档: https://www.xunhupay.com/doc/api/pay.html
// 网关地址由管理员在后台填写，应为完整的 do.html 入口，例如:
//
//	https://api.xunhupay.com/payment/do.html   (正式环境)
//	https://api.dpweixin.com/payment/do.html   (备用环境)
const (
	xunhuAPIVersion    = "1.1"
	xunhuPayStatusPaid = "OD" // 已支付
	xunhuNotifyAck     = "success"
	xunhuHTTPTimeout   = 15 * time.Second
)

type EpayTopUpRequest struct {
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
}

// xunhuPayResponse 虎皮椒 do.html 接口的响应结构
// 注意: 平台返回的是扁平结构, url/url_qrcode/errcode/errmsg/hash 都在顶层,
// 不存在 data 嵌套对象 (查询接口 query.html 才有 data 字段).
type xunhuPayResponse struct {
	ErrCode   int    `json:"errcode"`
	ErrMsg    string `json:"errmsg"`
	URL       string `json:"url"`
	URLQrcode string `json:"url_qrcode"`
	Hash      string `json:"hash"`
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

	// 虎皮椒按 appid 在平台侧决定支付通道，前端传入的 type 仅用于按钮区分，不再透传给上游。
	// 这里仅做合法性校验，确保前端传入的支付方式在管理员配置的白名单内。
	if req.Type != "" && normalizeEpayPayType(req.Type, ps.EpayPayTypes) == "" {
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

	payURL, err := requestEpayPayURL(ps, tradeNo, money)
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
	})
}

// EpayNotify 接收虎皮椒异步回调
// 协议: POST application/x-www-form-urlencoded，签名验 hash，订单状态字段 status，已支付为 "OD"，
// 商户订单号字段为 trade_order_id。应答必须为字面字符串 "success"，否则平台会重试。
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
	if !verifyXunhuSign(params, operation_setting.GetPaymentSetting().EpayKey) {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	if params["status"] != xunhuPayStatusPaid {
		// 非已支付状态（CD/RD/UD 等），按平台约定依旧回 success 避免重试
		c.String(http.StatusOK, xunhuNotifyAck)
		return
	}
	tradeNo := params["trade_order_id"]
	if tradeNo == "" {
		c.String(http.StatusOK, xunhuNotifyAck)
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.Status != common.TopUpStatusPending || topUp.PaymentMethod != paymentMethodEpay {
		c.String(http.StatusOK, xunhuNotifyAck)
		return
	}
	quota := int64(topUp.Money * common.MicrodollarsPerUnit)
	if err := model.CompleteTopUp(topUp, quota); err != nil {
		common.SysError("epay topup failed: " + err.Error())
		c.String(http.StatusOK, xunhuNotifyAck)
		return
	}
	c.String(http.StatusOK, xunhuNotifyAck)
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

// requestEpayPayURL 向虎皮椒 do.html 接口 POST JSON 发起付款请求，返回用户浏览器可跳转的支付页 URL
func requestEpayPayURL(ps *operation_setting.PaymentSetting, tradeNo string, money float64) (string, error) {
	apiURL := strings.TrimSpace(ps.EpayApiUrl)
	if apiURL == "" {
		return "", fmt.Errorf("易支付网关地址未配置")
	}
	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/epay/notify"
	returnURL := strings.TrimRight(system_setting.ServerAddress, "/") + "/api/epay/return"
	params := map[string]string{
		"version":        xunhuAPIVersion,
		"appid":          ps.EpayPid,
		"trade_order_id": tradeNo,
		"total_fee":      fmt.Sprintf("%.2f", money),
		"title":          "额度充值",
		"time":           fmt.Sprintf("%d", common.GetTimestamp()),
		"notify_url":     notifyURL,
		"return_url":     returnURL,
		"nonce_str":      common.GetRandomString(32),
	}
	params["hash"] = xunhuSign(params, ps.EpayKey)

	body, err := common.Marshal(params)
	if err != nil {
		return "", fmt.Errorf("构造易支付请求失败: %v", err)
	}
	httpReq, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("构造易支付请求失败: %v", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: xunhuHTTPTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("调用易支付网关失败: %v", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取易支付响应失败: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("易支付网关返回状态码 %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var payResp xunhuPayResponse
	if err := common.Unmarshal(raw, &payResp); err != nil {
		return "", fmt.Errorf("解析易支付响应失败: %v (body: %s)", err, strings.TrimSpace(string(raw)))
	}
	if payResp.ErrCode != 0 {
		return "", fmt.Errorf("易支付下单失败: %s", payResp.ErrMsg)
	}
	if payResp.URL == "" {
		return "", fmt.Errorf("易支付响应缺少支付链接")
	}
	return payResp.URL, nil
}

func verifyXunhuSign(params map[string]string, appSecret string) bool {
	received := strings.ToLower(params["hash"])
	if received == "" {
		return false
	}
	return received == xunhuSign(params, appSecret)
}

// xunhuSign 虎皮椒签名算法:
// 1) 取所有非空参数 (跳过 hash 字段与值为空的字段)
// 2) 按参数名 ASCII 升序排序
// 3) 拼接为 key1=value1&key2=value2...
// 4) 末尾直接追加 appsecret (无任何分隔符)
// 5) MD5 取 32 位小写 hex
func xunhuSign(params map[string]string, appSecret string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "hash" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + appSecret))
	return hex.EncodeToString(sum[:])
}