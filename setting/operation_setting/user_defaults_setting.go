package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// UserDefaultsSetting 新用户相关默认值（由运营配置持久化）
type UserDefaultsSetting struct {
	// DefaultVendorRatioMultipliers：供应商 ID -> 倍率，用于在计费时乘在系统模型价格/倍率上。
	DefaultVendorRatioMultipliers map[int]float64 `json:"default_vendor_ratio_multipliers"`
}

var userDefaultsSetting = UserDefaultsSetting{
	DefaultVendorRatioMultipliers: map[int]float64{},
}

func init() {
	config.GlobalConfig.Register("user_defaults_setting", &userDefaultsSetting)
}

func GetUserDefaultsSetting() *UserDefaultsSetting {
	return &userDefaultsSetting
}
