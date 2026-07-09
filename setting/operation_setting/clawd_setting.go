package operation_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

type ClawdGroupConfig struct {
	PriceWeight   float64 `json:"price_weight"`
	SuccessWeight float64 `json:"success_weight"`
	LatencyWeight float64 `json:"latency_weight"`
}

type ClawdSetting struct {
	Enabled              bool                        `json:"enabled"`
	WatchIntervalSeconds int                         `json:"watch_interval_seconds"`
	WindowSeconds        int                         `json:"window_seconds"`
	MinSampleSize        int                         `json:"min_sample_size"`
	GroupConfigs         map[string]ClawdGroupConfig `json:"group_configs"`
	ObservationCount     int                         `json:"observation_count"`
	ObservationSeconds   int                         `json:"observation_seconds"`
	AgentBaseURL         string                      `json:"agent_base_url"`
	AgentAPIKey          string                      `json:"agent_api_key"`
	AgentModel           string                      `json:"agent_model"`
}

var clawdSetting = ClawdSetting{
	Enabled:              false,
	WatchIntervalSeconds: 300,
	WindowSeconds:        300,
	MinSampleSize:        100,
	GroupConfigs:         map[string]ClawdGroupConfig{},
	ObservationCount:     3,
	ObservationSeconds:   600,
	AgentBaseURL:         "",
	AgentAPIKey:          "",
	AgentModel:           "",
}

func init() {
	config.GlobalConfig.Register("clawd_setting", &clawdSetting)
}

func GetClawdSetting() *ClawdSetting {
	return &clawdSetting
}

func (s *ClawdSetting) GetGroupConfig(group string) ClawdGroupConfig {
	if s.GroupConfigs == nil {
		return ClawdGroupConfig{0.45, 0.35, 0.20}
	}
	cfg, ok := s.GroupConfigs[group]
	if !ok {
		return ClawdGroupConfig{0.45, 0.35, 0.20}
	}
	return cfg
}