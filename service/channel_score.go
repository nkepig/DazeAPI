package service

import (
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type ChannelScore struct {
	ChannelId         int     `json:"channel_id"`
	ChannelName       string  `json:"channel_name"`
	ClawdGroup        int     `json:"clawd_group"`
	Group             string  `json:"group"`
	Priority          int64   `json:"priority"`
	Weight            uint    `json:"weight"`
	SuccessRate       float64 `json:"success_rate"`
	AvgUseTime        float64 `json:"avg_use_time"`
	SampleCount       int     `json:"sample_count"`
	SuccessCount      int     `json:"success_count"`
	ErrorCount        int     `json:"error_count"`
	LatencyPercentile float64 `json:"latency_percentile"`
	LatencyScore      float64 `json:"latency_score"`
	SuccessScore      float64 `json:"success_score"`
	Score             float64 `json:"score"`
	ScoreFormula      string  `json:"score_formula"`
}

type ChannelScoreStats struct {
	ClawdGroup        int           `json:"clawd_group"`
	MedianSuccessRate float64       `json:"median_success_rate"`
	MedianUseTime     float64       `json:"median_use_time"`
	Channels          []ChannelScore `json:"channels"`
}

type ScoreBreakdown struct {
	SuccessRate       float64 `json:"success_rate"`
	SuccessScore      float64 `json:"success_score"`
	AvgUseTime        float64 `json:"avg_use_time"`
	LatencyPercentile float64 `json:"latency_percentile"`
	LatencyScore      float64 `json:"latency_score"`
	SampleCount       int     `json:"sample_count"`
	ClawdGroup        int     `json:"clawd_group"`
}

func ComputeChannelScores(windowSeconds int64) (map[int]*ChannelScoreStats, error) {
	channels, err := model.GetWatchedChannels()
	if err != nil {
		return nil, err
	}
	if len(channels) == 0 {
		return make(map[int]*ChannelScoreStats), nil
	}

	endTimestamp := time.Now().Unix()
	startTimestamp := endTimestamp - windowSeconds
	channelIds := make([]int, 0, len(channels))
	for _, ch := range channels {
		channelIds = append(channelIds, ch.Id)
	}

	type logAgg struct {
		Group        string
		ChannelId    int
		ChannelName  string
		SuccessCount int64
		ErrorCount   int64
		SumUseTime   int64
		TimedCount   int64
	}

	var results []logAgg
	err = model.LOG_DB.Table("logs").
		Select("\"group\", channel_id, MAX(channel_name) as channel_name, "+
			"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_count, "+
			"SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS error_count, "+
			"SUM(use_time) AS sum_use_time, "+
			"SUM(CASE WHEN use_time > 0 THEN 1 ELSE 0 END) AS timed_count",
			model.LogTypeConsume, model.LogTypeError).
		Where("channel_id IN ? AND type IN ? AND created_at >= ? AND created_at <= ?",
			channelIds, []int{model.LogTypeConsume, model.LogTypeError}, startTimestamp, endTimestamp).
		Group("\"group\", channel_id").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	clawdGroupStats := make(map[int]*ChannelScoreStats)
	channelIdToChannel := make(map[int]*model.Channel)
	for _, ch := range channels {
		channelIdToChannel[ch.Id] = ch
	}

	for _, r := range results {
		ch, ok := channelIdToChannel[r.ChannelId]
		if !ok {
			continue
		}

		total := r.SuccessCount + r.ErrorCount
		if total == 0 {
			continue
		}

		successRate := float64(r.SuccessCount) / float64(total)
		var avgUseTime float64
		if r.TimedCount > 0 {
			avgUseTime = float64(r.SumUseTime) / float64(r.TimedCount)
		}

		score := ChannelScore{
			ChannelId:    r.ChannelId,
			ChannelName:  r.ChannelName,
			ClawdGroup:   ch.ChannelInfo.ClawdGroup,
			Group:        r.Group,
			Priority:     ch.GetPriority(),
			SuccessRate:  successRate,
			AvgUseTime:   avgUseTime,
			SampleCount:  int(total),
			SuccessCount: int(r.SuccessCount),
			ErrorCount:   int(r.ErrorCount),
			SuccessScore: successRate * 100,
		}

		if ch.Weight != nil {
			score.Weight = *ch.Weight
		}

		cg := ch.ChannelInfo.ClawdGroup
		if _, ok := clawdGroupStats[cg]; !ok {
			clawdGroupStats[cg] = &ChannelScoreStats{ClawdGroup: cg}
		}
		clawdGroupStats[cg].Channels = append(clawdGroupStats[cg].Channels, score)
	}

	for _, stats := range clawdGroupStats {
		if len(stats.Channels) < 2 {
			continue
		}

		successRates := make([]float64, 0, len(stats.Channels))
		useTimes := make([]float64, 0, len(stats.Channels))
		for _, ch := range stats.Channels {
			successRates = append(successRates, ch.SuccessRate)
			if ch.AvgUseTime > 0 {
				useTimes = append(useTimes, ch.AvgUseTime)
			}
		}
		stats.MedianSuccessRate = median(successRates)
		if len(useTimes) > 0 {
			stats.MedianUseTime = median(useTimes)
		}

		sortedUseTimes := make([]float64, len(useTimes))
		copy(sortedUseTimes, useTimes)
		sort.Float64s(sortedUseTimes)

		for i := range stats.Channels {
			ch := &stats.Channels[i]
			if ch.AvgUseTime <= 0 || len(sortedUseTimes) == 0 {
				ch.LatencyPercentile = 1.0
				ch.LatencyScore = 0
			} else {
				rank := 0
				for _, t := range sortedUseTimes {
					if t < ch.AvgUseTime {
						rank++
					}
				}
				n := len(sortedUseTimes)
				if n > 1 {
					ch.LatencyPercentile = float64(rank) / float64(n-1)
				} else {
					ch.LatencyPercentile = 0
				}
				ch.LatencyScore = 100 * (1 - ch.LatencyPercentile)
			}

			rawScore := ch.SuccessScore*0.6 + ch.LatencyScore*0.4
			ch.Score = math.Round(rawScore*10) / 10
			ch.ScoreFormula = fmt.Sprintf("%.2f × 60 + %.2f × 40 = %.1f",
				ch.SuccessRate, ch.LatencyScore/100, ch.Score)
		}
	}

	return clawdGroupStats, nil
}

func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	n := len(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

func IsProblemChannel(ch ChannelScore, stats *ChannelScoreStats) (bool, string) {
	if len(stats.Channels) < 2 {
		return false, ""
	}
	cfg := operation_setting.GetClawdSetting()

	threshold := stats.MedianSuccessRate * cfg.SuccessRateRatio
	if ch.SuccessRate < threshold {
		return true, fmt.Sprintf("成功率 %.0f%% 低于中位数 %.0f%% 的 1/%.0f (%.0f%%)",
			ch.SuccessRate*100, stats.MedianSuccessRate*100,
			1.0/cfg.SuccessRateRatio, threshold*100)
	}

	if stats.MedianUseTime > 0 && ch.AvgUseTime > stats.MedianUseTime*cfg.LatencyMultiplier {
		return true, fmt.Sprintf("返回时间 %.1fs 超过中位数 %.1fs 的 %.0f 倍",
			ch.AvgUseTime, stats.MedianUseTime, cfg.LatencyMultiplier)
	}

	return false, ""
}

func BuildScoreBreakdownJSON(ch ChannelScore, clawdGroup int) string {
	bd := ScoreBreakdown{
		SuccessRate:       ch.SuccessRate,
		SuccessScore:      ch.SuccessScore,
		AvgUseTime:        ch.AvgUseTime,
		LatencyPercentile: ch.LatencyPercentile,
		LatencyScore:      ch.LatencyScore,
		SampleCount:       ch.SampleCount,
		ClawdGroup:        clawdGroup,
	}
	bytes, err := common.Marshal(&bd)
	if err != nil {
		return ""
	}
	return string(bytes)
}
