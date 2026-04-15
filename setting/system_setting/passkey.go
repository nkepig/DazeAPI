package system_setting

// PasskeySettings holds Passkey/WebAuthn configuration.
// The passkey feature has been removed; this stub prevents compilation errors.
type PasskeySettings struct {
	Enabled               bool   `json:"enabled"`
	RPDisplayName         string `json:"rp_display_name"`
	RPID                  string `json:"rp_id"`
	Origins               string `json:"origins"`
	AllowInsecureOrigin   bool   `json:"allow_insecure_origin"`
	UserVerification      string `json:"user_verification"`
	AttachmentPreference  string `json:"attachment_preference"`
}

// GetPasskeySettings returns disabled passkey settings.
func GetPasskeySettings() *PasskeySettings {
	return &PasskeySettings{Enabled: false}
}
