package operation_setting

// CheckinSetting holds check-in feature configuration.
// The check-in feature has been removed; this stub prevents compilation errors.
type CheckinSetting struct {
	Enabled bool `json:"enabled"`
}

var defaultCheckinSetting = CheckinSetting{Enabled: false}

// GetCheckinSetting returns disabled check-in settings.
func GetCheckinSetting() CheckinSetting {
	return defaultCheckinSetting
}
