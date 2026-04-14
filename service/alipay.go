package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type alipayPrecreateBiz struct {
	OutTradeNo  string `json:"out_trade_no"`
	TotalAmount string `json:"total_amount"`
	Subject     string `json:"subject"`
}

type alipayQueryBiz struct {
	OutTradeNo string `json:"out_trade_no"`
}

func alipayPostForm(gateway string, form url.Values) ([]byte, error) {
	req, err := http.NewRequest(http.MethodPost, gateway, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func AlipayCreatePayment(orderNo string, amount float64, subject string, notifyUrl string) (string, error) {
	ps := operation_setting.GetPaymentSetting()
	if ps.AlipayPrivateKey == "" {
		return "", fmt.Errorf("支付宝私钥未配置")
	}

	params := alipayBuildCommonParams("alipay.trade.precreate", ps.AlipayAppId)
	if notifyUrl != "" {
		params["notify_url"] = notifyUrl
	}
	biz := alipayPrecreateBiz{
		OutTradeNo:  orderNo,
		TotalAmount: fmt.Sprintf("%.2f", amount),
		Subject:     subject,
	}
	bizBytes, err := common.Marshal(biz)
	if err != nil {
		return "", fmt.Errorf("biz_content 序列化失败: %v", err)
	}
	params["biz_content"] = string(bizBytes)

	signStr, err := alipaySignParams(params, ps.AlipayPrivateKey)
	if err != nil {
		return "", fmt.Errorf("签名失败: %v", err)
	}
	params["sign"] = signStr

	gateway := ps.AlipayGateway
	if gateway == "" {
		gateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}

	body, err := alipayPostForm(gateway, alipayBuildFormData(params))
	if err != nil {
		return "", fmt.Errorf("请求支付宝失败: %v", err)
	}

	result, err := alipayParseResponse(body, "alipay_trade_precreate_response")
	if err != nil {
		return "", err
	}

	if result["code"] != "10000" {
		subMsg := result["sub_msg"]
		if subMsg == "" {
			subMsg = result["msg"]
		}
		return "", fmt.Errorf("支付宝返回错误: %s", subMsg)
	}

	return result["qr_code"], nil
}

func AlipayQueryPayment(orderNo string) (string, error) {
	ps := operation_setting.GetPaymentSetting()
	if ps.AlipayPrivateKey == "" {
		return "", fmt.Errorf("支付宝私钥未配置")
	}

	params := alipayBuildCommonParams("alipay.trade.query", ps.AlipayAppId)
	qbiz := alipayQueryBiz{OutTradeNo: orderNo}
	qbizBytes, err := common.Marshal(qbiz)
	if err != nil {
		return "", fmt.Errorf("biz_content 序列化失败: %v", err)
	}
	params["biz_content"] = string(qbizBytes)

	signStr, err := alipaySignParams(params, ps.AlipayPrivateKey)
	if err != nil {
		return "", fmt.Errorf("签名失败: %v", err)
	}
	params["sign"] = signStr

	gateway := ps.AlipayGateway
	if gateway == "" {
		gateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}

	body, err := alipayPostForm(gateway, alipayBuildFormData(params))
	if err != nil {
		return "", fmt.Errorf("请求支付宝失败: %v", err)
	}

	result, err := alipayParseResponse(body, "alipay_trade_query_response")
	if err != nil {
		return "", err
	}

	if result["code"] != "10000" {
		return "", fmt.Errorf("查询失败: %s", result["sub_msg"])
	}

	return result["trade_status"], nil
}

func AlipayVerifyCallback(params map[string]string) bool {
	ps := operation_setting.GetPaymentSetting()
	if ps.AlipayPublicKey == "" {
		return true
	}

	sign, ok := params["sign"]
	if !ok {
		return false
	}
	delete(params, "sign")
	delete(params, "sign_type")

	unsigned := alipayBuildSignContent(params)
	publicKey, err := alipayLoadPublicKey(ps.AlipayPublicKey)
	if err != nil {
		return false
	}

	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return false
	}

	hashed := sha256.Sum256([]byte(unsigned))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hashed[:], signBytes) == nil
}

func alipayBuildCommonParams(method string, appId string) map[string]string {
	return map[string]string{
		"app_id":    appId,
		"method":    method,
		"format":    "JSON",
		"charset":   "utf-8",
		"sign_type": "RSA2",
		"timestamp": time.Now().Format("2006-01-02 15:04:05"),
		"version":   "1.0",
	}
}

func alipaySignParams(params map[string]string, privateKeyStr string) (string, error) {
	unsigned := alipayBuildSignContent(params)
	privKey, err := alipayLoadPrivateKey(privateKeyStr)
	if err != nil {
		return "", err
	}

	hashed := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

func alipayBuildSignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		if params[k] != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, k+"="+params[k])
	}
	return strings.Join(pairs, "&")
}

func alipayBuildFormData(params map[string]string) url.Values {
	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}
	return form
}

func alipayLoadPrivateKey(privateKeyStr string) (*rsa.PrivateKey, error) {
	pemStr := strings.TrimSpace(privateKeyStr)
	if !strings.Contains(pemStr, "-----") {
		pemStr = "-----BEGIN PRIVATE KEY-----\n" + pemStr + "\n-----END PRIVATE KEY-----"
	}

	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("无法解析私钥 PEM")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		key2, err2 := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err2 != nil {
			return nil, fmt.Errorf("解析私钥失败: %v", err)
		}
		return key2, nil
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("密钥类型不是 RSA")
	}
	return rsaKey, nil
}

func alipayLoadPublicKey(publicKeyStr string) (*rsa.PublicKey, error) {
	pemStr := strings.TrimSpace(publicKeyStr)
	if !strings.Contains(pemStr, "-----") {
		pemStr = "-----BEGIN PUBLIC KEY-----\n" + pemStr + "\n-----END PUBLIC KEY-----"
	}

	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("无法解析公钥 PEM")
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("密钥类型不是 RSA")
	}
	return rsaKey, nil
}

func alipayParseResponse(body []byte, responseKey string) (map[string]string, error) {
	var resp map[string]json.RawMessage
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %v", err)
	}

	rawData, ok := resp[responseKey]
	if !ok {
		return nil, fmt.Errorf("响应中缺少 %s", responseKey)
	}

	var dataMap map[string]interface{}
	if err := json.Unmarshal(rawData, &dataMap); err != nil {
		return nil, fmt.Errorf("响应格式错误")
	}

	result := make(map[string]string)
	for k, v := range dataMap {
		result[k] = fmt.Sprintf("%v", v)
	}

	return result, nil
}