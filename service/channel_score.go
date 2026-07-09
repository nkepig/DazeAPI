package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type ChannelScore struct {
	ChannelId    int     `json:"channel_id"`
	ChannelName  string  `json:"channel_name"`
	ClawdGroup   string  `json:"clawd_group"`
	Group        string  `json:"group"`
	Priority     int64   `json:"priority"`
	Weight       uint    `json:"weight"`
	CostRatio    float64 `json:"cost_ratio"`
	Profit       float64 `json:"profit"`
	AvgUserRatio float64 `json:"avg_user_ratio"`
	PriceScore   float64 `json:"price_score"`
	SuccessRate  float64 `json:"success_rate"`
	AvgUseTime   float64 `json:"avg_use_time"`
	SampleCount  int     `json:"sample_count"`
	SuccessCount int     `json:"success_count"`
	ErrorCount   int     `json:"error_count"`
	LatencyScore float64 `json:"latency_score"`
	SuccessScore float64 `json:"success_score"`
	PriceWeight    float64 `json:"price_weight"`
	SuccessWeight  float64 `json:"success_weight"`
	LatencyWeight  float64 `json:"latency_weight"`
	MaxProfit      float64 `json:"max_profit"`
	MaxSuccessRate float64 `json:"max_success_rate"`
	MinUseTime     float64 `json:"min_use_time"`
	Score        float64 `json:"score"`
	ScoreFormula string  `json:"score_formula"`
}

type ChannelScoreStats struct {
	ClawdGroup     string        `json:"clawd_group"`
	AvgUserRatio   float64      `json:"avg_user_ratio"`
	MaxProfit      float64      `json:"max_profit"`
	MaxSuccessRate float64      `json:"max_success_rate"`
	MinUseTime     float64      `json:"min_use_time"`
	Channels       []ChannelScore `json:"channels"`
}

type ScoreBreakdown struct {
	CostRatio    float64 `json:"cost_ratio"`
	Profit       float64 `json:"profit"`
	AvgUserRatio float64 `json:"avg_user_ratio"`
	PriceScore   float64 `json:"price_score"`
	SuccessRate  float64 `json:"success_rate"`
	SuccessScore float64 `json:"success_score"`
	AvgUseTime   float64 `json:"avg_use_time"`
	LatencyScore float64 `json:"latency_score"`
	SampleCount  int     `json:"sample_count"`
	ClawdGroup   string  `json:"clawd_group"`
	PriceWeight   float64 `json:"price_weight"`
	SuccessWeight float64 `json:"success_weight"`
	LatencyWeight float64 `json:"latency_weight"`
	MaxProfit      float64 `json:"max_profit"`
	MaxSuccessRate float64 `json:"max_success_rate"`
	MinUseTime     float64 `json:"min_use_time"`
}

type channelAgg struct {
	ChannelId    int
	ChannelName  string
	SuccessCount int64
	ErrorCount   int64
	SumUseTime   int64
	TimedCount   int64
}

type clawdGroupData struct {
	channelAggs     map[int]*channelAgg
	userGroupCounts map[string]int64
}

func ComputeChannelScores(windowSeconds int64) (map[string]*ChannelScoreStats, error) {
	channels, err := model.GetWatchedChannels()
	if err != nil {
		return nil, err
	}
	if len(channels) == 0 {
		return make(map[string]*ChannelScoreStats), nil
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
			"SUM(CASE WHEN type = ? THEN use_time ELSE 0 END) AS sum_use_time, "+
			"SUM(CASE WHEN type = ? AND use_time > 0 THEN 1 ELSE 0 END) AS timed_count",
			model.LogTypeConsume, model.LogTypeError, model.LogTypeConsume, model.LogTypeConsume).
		Where("channel_id IN ? AND type IN ? AND created_at >= ? AND created_at <= ?",
			channelIds, []int{model.LogTypeConsume, model.LogTypeError}, startTimestamp, endTimestamp).
		Group("\"group\", channel_id").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	channelIdToChannel := make(map[int]*model.Channel)
	for _, ch := range channels {
		channelIdToChannel[ch.Id] = ch
	}

	clawdGroups := make(map[string]*clawdGroupData)

	for _, r := range results {
		ch, ok := channelIdToChannel[r.ChannelId]
		if !ok {
			continue
		}
		cg := ch.ChannelInfo.ClawdGroup.String()
		if cg == "" {
			continue
		}

		if _, ok := clawdGroups[cg]; !ok {
			clawdGroups[cg] = &clawdGroupData{
				channelAggs:     make(map[int]*channelAgg),
				userGroupCounts: make(map[string]int64),
			}
		}
		gd := clawdGroups[cg]

		if _, ok := gd.channelAggs[r.ChannelId]; !ok {
			gd.channelAggs[r.ChannelId] = &channelAgg{
				ChannelId:   r.ChannelId,
				ChannelName: r.ChannelName,
			}
		}
		agg := gd.channelAggs[r.ChannelId]
		agg.SuccessCount += r.SuccessCount
		agg.ErrorCount += r.ErrorCount
		agg.SumUseTime += r.SumUseTime
		agg.TimedCount += r.TimedCount
		total := r.SuccessCount + r.ErrorCount
		gd.userGroupCounts[r.Group] += total
	}

	clawdGroupStats := make(map[string]*ChannelScoreStats)

	for cg, gd := range clawdGroups {
		avgUserRatio := computeAvgUserRatio(gd.userGroupCounts)

		stats := &ChannelScoreStats{
			ClawdGroup:   cg,
			AvgUserRatio: avgUserRatio,
		}

		for channelId, agg := range gd.channelAggs {
			ch := channelIdToChannel[channelId]
			total := agg.SuccessCount + agg.ErrorCount
			if total == 0 {
				continue
			}

			successRate := float64(agg.SuccessCount) / float64(total)
			var avgUseTime float64
			if agg.TimedCount > 0 {
				avgUseTime = float64(agg.SumUseTime) / float64(agg.TimedCount)
			}

			costRatio := ch.ChannelInfo.ClawdCostRatio
			profit := 0.0
			if costRatio > 0 {
				profit = avgUserRatio - costRatio
			}

		score := ChannelScore{
			ChannelId:    channelId,
			ChannelName:  ch.Name,
			ClawdGroup:   cg,
				Group:        ch.Group,
				Priority:     ch.GetPriority(),
				CostRatio:    costRatio,
				Profit:       profit,
				AvgUserRatio: avgUserRatio,
				SuccessRate:  successRate,
				AvgUseTime:   avgUseTime,
				SampleCount:  int(total),
				SuccessCount: int(agg.SuccessCount),
				ErrorCount:   int(agg.ErrorCount),
			}
			if ch.Weight != nil {
				score.Weight = *ch.Weight
			}

			if profit > stats.MaxProfit {
				stats.MaxProfit = profit
			}
			if successRate > stats.MaxSuccessRate {
				stats.MaxSuccessRate = successRate
			}
			if avgUseTime > 0 {
				if stats.MinUseTime == 0 || avgUseTime < stats.MinUseTime {
					stats.MinUseTime = avgUseTime
				}
			}

			stats.Channels = append(stats.Channels, score)
		}

		if len(stats.Channels) < 2 {
			clawdGroupStats[cg] = stats
			continue
		}

		cfg := operation_setting.GetClawdSetting().GetGroupConfig(cg)
		priceW := cfg.PriceWeight
		successW := cfg.SuccessWeight
		latencyW := cfg.LatencyWeight

		for i := range stats.Channels {
			ch := &stats.Channels[i]

			if stats.MaxProfit > 0 && ch.Profit > 0 {
				ch.PriceScore = 100 * ch.Profit / stats.MaxProfit
			} else if stats.MaxProfit <= 0 {
				ch.PriceScore = 100
			} else {
				ch.PriceScore = 0
			}

			if stats.MaxSuccessRate > 0 {
				ch.SuccessScore = 100 * ch.SuccessRate / stats.MaxSuccessRate
			} else {
				ch.SuccessScore = 100
			}

			if ch.AvgUseTime > 0 && stats.MinUseTime > 0 {
				ch.LatencyScore = 100 * stats.MinUseTime / ch.AvgUseTime
			} else {
				ch.LatencyScore = 0
			}

			ch.PriceWeight = priceW
			ch.SuccessWeight = successW
			ch.LatencyWeight = latencyW
			ch.MaxProfit = stats.MaxProfit
			ch.MaxSuccessRate = stats.MaxSuccessRate
			ch.MinUseTime = stats.MinUseTime

			rawScore := ch.PriceScore*priceW + ch.SuccessScore*successW + ch.LatencyScore*latencyW
			ch.Score = math.Round(rawScore*10) / 10
			ch.ScoreFormula = fmt.Sprintf("价格%.0f×%.0f%% + 成功%.0f×%.0f%% + 速度%.0f×%.0f%% = %.1f",
				ch.PriceScore, priceW*100,
				ch.SuccessScore, successW*100,
				ch.LatencyScore, latencyW*100,
				ch.Score)
		}

		clawdGroupStats[cg] = stats
	}

	return clawdGroupStats, nil
}

func computeAvgUserRatio(groupCounts map[string]int64) float64 {
	if len(groupCounts) == 0 {
		return 1.0
	}
	var totalWeight, weightedSum float64
	grs := ratio_setting.GetGroupRatioSetting().GroupRatio
	for groupName, cnt := range groupCounts {
		ratio, ok := grs.Get(groupName)
		if !ok {
			ratio = 1.0
		}
		weightedSum += ratio * float64(cnt)
		totalWeight += float64(cnt)
	}
	if totalWeight == 0 {
		return 1.0
	}
	return weightedSum / totalWeight
}

func BuildScoreBreakdownJSON(ch ChannelScore, clawdGroup string) string {
	bd := ScoreBreakdown{
		CostRatio:      ch.CostRatio,
		Profit:         ch.Profit,
		AvgUserRatio:   ch.AvgUserRatio,
		PriceScore:     ch.PriceScore,
		SuccessRate:    ch.SuccessRate,
		SuccessScore:   ch.SuccessScore,
		AvgUseTime:     ch.AvgUseTime,
		LatencyScore:   ch.LatencyScore,
		SampleCount:    ch.SampleCount,
		ClawdGroup:     clawdGroup,
		PriceWeight:    ch.PriceWeight,
		SuccessWeight:  ch.SuccessWeight,
		LatencyWeight:  ch.LatencyWeight,
		MaxProfit:      ch.MaxProfit,
		MaxSuccessRate: ch.MaxSuccessRate,
		MinUseTime:     ch.MinUseTime,
	}
	bytes, err := common.Marshal(&bd)
	if err != nil {
		return ""
	}
	return string(bytes)
}