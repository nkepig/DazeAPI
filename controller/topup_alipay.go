package controller

import (
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

type AlipayTopUpRequest struct {
	Amount float64 `json:"amount"`
}

func RequestAlipayTopUp(c *gin.Context) {
	ps := operation_setting.GetPaymentSetting()
	if ps.AlipayAppId == "" || ps.AlipayPrivateKey == "" {
		common.ApiErrorMsg(c, "支付宝支付未配置")
		return
	}

	var req AlipayTopUpRequest
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

	amount := int64(math.Round(money))
	quota := int64(money * common.QuotaPerUnit)

	tradeNo := fmt.Sprintf("ALI%d%d", userId, common.GetTimestamp())

	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        amount,
		Money:         money,
		TradeNo:       tradeNo,
		PaymentMethod: "alipay",
		Status:        common.TopUpStatusPending,
		CreateTime:    common.GetTimestamp(),
	}

	if err := topUp.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	notifyUrl := ps.AlipayNotifyUrl
	if notifyUrl == "" {
		if base := strings.TrimSuffix(strings.TrimSpace(system_setting.ServerAddress), "/"); base != "" {
			notifyUrl = base + "/api/alipay/notify"
		}
	}

	qrUrl, err := service.AlipayCreatePayment(tradeNo, money, "额度充值", notifyUrl)
	if err != nil {
		topUp.Status = "failed"
		_ = topUp.Update()
		common.ApiErrorMsg(c, err.Error())
		return
	}

	topUp.QrUrl = qrUrl
	_ = topUp.Update()

	common.ApiSuccess(c, gin.H{
		"trade_no":  tradeNo,
		"qr_url":    qrUrl,
		"amount":    amount,
		"money":     money,
		"quota":     quota,
	})
}

func AlipayTopUpStatus(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "用户未登录")
		return
	}

	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		common.ApiErrorMsg(c, "订单号不能为空")
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != userId {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	// 异步 notify 需公网 HTTPS；内网/本地无法收到时，通过主动查询支付宝订单状态完成充值（与回调逻辑一致）
	syncAlipayTopUpIfPaid(topUp)
	topUp = model.GetTopUpByTradeNo(tradeNo)

	common.ApiSuccess(c, gin.H{
		"status": topUp.Status,
		"amount": topUp.Amount,
		"money":  topUp.Money,
	})
}

// syncAlipayTopUpIfPaid 在订单仍为 pending 时调用 alipay.trade.query，若已支付则入账（幂等）
func syncAlipayTopUpIfPaid(topUp *model.TopUp) {
	if topUp == nil || topUp.Status != common.TopUpStatusPending || topUp.PaymentMethod != "alipay" {
		return
	}
	tradeStatus, err := service.AlipayQueryPayment(topUp.TradeNo)
	if err != nil {
		return
	}
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		return
	}
	quota := int64(topUp.Money * common.QuotaPerUnit)
	_ = model.CompleteTopUp(topUp, quota)
}

func AlipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	params := make(map[string]string)
	for k, v := range c.Request.Form {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	if !service.AlipayVerifyCallback(params) {
		c.String(http.StatusBadRequest, "sign fail")
		return
	}

	tradeStatus := params["trade_status"]
	outTradeNo := params["out_trade_no"]

	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		c.String(http.StatusOK, "success")
		return
	}

	topUp := model.GetTopUpByTradeNo(outTradeNo)
	if topUp == nil {
		c.String(http.StatusOK, "success")
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		c.String(http.StatusOK, "success")
		return
	}

	// 按实付金额（元，可含分）折算额度
	quota := int64(topUp.Money * common.QuotaPerUnit)

	err := model.CompleteTopUp(topUp, quota)
	if err != nil {
		c.String(http.StatusOK, "success")
		return
	}

	c.String(http.StatusOK, "success")
}