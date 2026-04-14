package service

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// GetCallbackAddress 返回对外回调基址：优先 CustomCallbackAddress，否则为 ServerAddress（Waffo 等使用）
func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}
