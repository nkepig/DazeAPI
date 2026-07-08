package operation_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

type ClawdSetting struct {
	Enabled              bool    `json:"enabled"`
	WatchIntervalSeconds int     `json:"watch_interval_seconds"`
	WindowSeconds        int     `json:"window_seconds"`
	MinSampleSize        int     `json:"min_sample_size"`
	SuccessRateRatio     float64 `json:"success_rate_ratio"`
	LatencyMultiplier    float64 `json:"latency_multiplier"`
	ObservationCount     int     `json:"observation_count"`
	ObservationSeconds   int     `json:"observation_seconds"`
}

var clawdSetting = ClawdSetting{
	Enabled:              false,
	WatchIntervalSeconds: 300,
	WindowSeconds:        300,
	MinSampleSize:        100,
	SuccessRateRatio:     1.0 / 3.0,
	LatencyMultiplier:    3.0,
	ObservationCount:     3,
	ObservationSeconds:   600,
}

func init() {
	config.GlobalConfig.Register("clawd_setting", &clawdSetting)
}

func GetClawdSetting() *ClawdSetting {
	return &clawdSetting
}
