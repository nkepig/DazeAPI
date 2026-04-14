package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions    []int           `json:"amount_options"`
	AmountDiscount   map[int]float64 `json:"amount_discount"`
	AlipayAppId      string          `json:"alipay_app_id"`
	AlipayPrivateKey string          `json:"alipay_private_key"`
	AlipayPublicKey  string          `json:"alipay_public_key"`
	AlipayGateway    string          `json:"alipay_gateway"`
	AlipayNotifyUrl  string          `json:"alipay_notify_url"`
}

var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
	AlipayGateway:  "https://openapi.alipay.com/gateway.do",
}

func init() {
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

// CustomCallbackAddress 对外回调基址（空则使用 system_setting.ServerAddress）
var CustomCallbackAddress = ""

// Price / MinTopUp / USDExchangeRate 由 model/option 同步，用于额度计价与充值金额下限等
var Price = 7.3
var MinTopUp = 1
var USDExchangeRate = 7.3
