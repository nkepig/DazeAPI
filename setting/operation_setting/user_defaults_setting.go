package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// UserDefaultsSetting 新用户相关默认值（由运营配置持久化）
type UserDefaultsSetting struct {
	// DefaultVendorRatioMultipliers：供应商 ID -> 倍率。新用户 ModelOverrides 中：按 Token 计费时写入为「分组倍率」乘在系统 modelRatio 上；按次计费时乘在系统价格上（缺省或未配置视为 1.0）
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

// VendorRatioMultiplier 返回供应商对应的新用户默认倍率乘数；无效或未配置时为 1.0
func VendorRatioMultiplier(vendorID int) float64 {
	if vendorID <= 0 {
		return 1.0
	}
	s := GetUserDefaultsSetting()
	if s == nil || len(s.DefaultVendorRatioMultipliers) == 0 {
		return 1.0
	}
	m, ok := s.DefaultVendorRatioMultipliers[vendorID]
	if !ok || m <= 0 {
		return 1.0
	}
	return m
}
