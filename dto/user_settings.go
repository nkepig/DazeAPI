package dto

// UserModelOverride 表示管理员为用户指定的单个模型的计费覆盖
type UserModelOverride struct {
	BillingType string  `json:"billing_type"` // "ratio"（按 Token 倍率）或 "price"（按次固定价格）
	Value       float64 `json:"value"`        // 倍率值或价格值
}

type UserSetting struct {
	NotifyType                       string  `json:"notify_type,omitempty"`
	QuotaWarningThreshold            float64 `json:"quota_warning_threshold,omitempty"`
	WebhookUrl                       string  `json:"webhook_url,omitempty"`
	WebhookSecret                    string  `json:"webhook_secret,omitempty"`
	NotificationEmail                string  `json:"notification_email,omitempty"`
	BarkUrl                          string  `json:"bark_url,omitempty"`
	GotifyUrl                        string  `json:"gotify_url,omitempty"`
	GotifyToken                      string  `json:"gotify_token,omitempty"`
	GotifyPriority                   int     `json:"gotify_priority"`
	UpstreamModelUpdateNotifyEnabled bool    `json:"upstream_model_update_notify_enabled,omitempty"`
	RecordIpLog                      bool    `json:"record_ip_log,omitempty"`
	SidebarModules                   string  `json:"sidebar_modules,omitempty"`
	BillingPreference                string  `json:"billing_preference,omitempty"`
	Language                         string  `json:"language,omitempty"`
	// ModelOverrides 管理员为该用户指定的可用模型及其计费覆盖。
	// 非空时：用户只能使用 map 中的模型，模型列表也只显示这些模型。
	ModelOverrides map[string]UserModelOverride `json:"model_overrides,omitempty"`
}

var (
	NotifyTypeEmail   = "email"   // Email 邮件
	NotifyTypeWebhook = "webhook" // Webhook
	NotifyTypeBark    = "bark"    // Bark 推送
	NotifyTypeGotify  = "gotify"  // Gotify 推送
)
