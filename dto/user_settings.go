package dto

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
}

var (
	NotifyTypeEmail   = "email"   // Email 邮件
	NotifyTypeWebhook = "webhook" // Webhook
	NotifyTypeBark    = "bark"    // Bark 推送
	NotifyTypeGotify  = "gotify"  // Gotify 推送
)
