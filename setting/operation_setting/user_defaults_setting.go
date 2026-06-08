package operation_setting

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// UserDefaultsSetting 用户相关默认值（由运营配置持久化）
type UserDefaultsSetting struct {
	// DefaultVendorRatioMultipliers：供应商 ID -> 倍率，用于在计费时乘在系统模型价格/倍率上。
	DefaultVendorRatioMultipliers map[int]float64 `json:"default_vendor_ratio_multipliers"`
	// DefaultRegistrationGroupRatio：默认可用分组及倍率，对未单独配置分组的用户生效作为全局兜底。
	DefaultRegistrationGroupRatio map[string]float64 `json:"default_registration_group_ratio"`
}

var userDefaultsSetting = UserDefaultsSetting{
	DefaultVendorRatioMultipliers: map[int]float64{},
	DefaultRegistrationGroupRatio: map[string]float64{},
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

func DefaultRegistrationGroupRatioCopy() map[string]float64 {
	s := GetUserDefaultsSetting()
	result := make(map[string]float64)
	if s == nil || len(s.DefaultRegistrationGroupRatio) == 0 {
		return result
	}
	for group, ratio := range s.DefaultRegistrationGroupRatio {
		result[group] = ratio
	}
	return result
}

func NormalizeDefaultRegistrationGroupRatio(input map[string]float64) (map[string]float64, error) {
	normalized := make(map[string]float64)
	for group, ratio := range input {
		name := strings.TrimSpace(group)
		if name == "" {
			continue
		}
		if ratio <= 0 || ratio > 1000 {
			return nil, errors.New("倍率须在 (0, 1000] 之间: " + name)
		}
		normalized[name] = ratio
	}
	return normalized, nil
}
