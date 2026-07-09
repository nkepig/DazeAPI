package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
	channelAggs map[int]*channelAgg
	groupCounts map[string]int64
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
	groupSet := make(map[string]struct{})
	var groupList []string

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
				channelAggs: make(map[int]*channelAgg),
				groupCounts: make(map[string]int64),
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
		gd.groupCounts[r.Group] += total

		if _, ok := groupSet[r.Group]; !ok {
			groupSet[r.Group] = struct{}{}
			groupList = append(groupList, r.Group)
		}
	}

	clawdGroupStats := make(map[string]*ChannelScoreStats)

	// 按实际用户倍率加权平均：查 (group, user_id) 调用量，再批量查用户 groupratio
	// group_discount 是每个用户的 groupratio 对该 group 的倍率，不同用户可能不同，不能用单条 log 代表
	type userGroupCount struct {
		Group   string
		UserId  int
		ReqCount int64
	}
	var userGroupCounts []userGroupCount
	err = model.LOG_DB.Table("logs").
		Select("\"group\", user_id, COUNT(*) as req_count").
		Where("channel_id IN ? AND type IN ? AND created_at >= ? AND created_at <= ?",
			channelIds, []int{model.LogTypeConsume, model.LogTypeError}, startTimestamp, endTimestamp).
		Group("\"group\", user_id").
		Scan(&userGroupCounts).Error
	if err != nil {
		return nil, err
	}

	userIdSet := make(map[int]struct{})
	var userIds []int
	for _, ugc := range userGroupCounts {
		if _, ok := userIdSet[ugc.UserId]; !ok {
			userIdSet[ugc.UserId] = struct{}{}
			userIds = append(userIds, ugc.UserId)
		}
	}

	type userRatioRow struct {
		Id          int
		GroupRatio  string
	}
	var userRatioRows []userRatioRow
	if len(userIds) > 0 {
		err = model.DB.Table("users").
			Select("id, groupratio").
			Where("id IN ?", userIds).
			Scan(&userRatioRows).Error
		if err != nil {
			return nil, err
		}
	}
	userGroupRatio := make(map[int]map[string]float64)
	for _, ur := range userRatioRows {
		ratios := make(map[string]float64)
		if ur.GroupRatio != "" {
			var raw map[string]any
			if jsonErr := common.UnmarshalJsonStr(ur.GroupRatio, &raw); jsonErr == nil {
				for g, v := range raw {
					if f, ok := v.(float64); ok {
						ratios[g] = f
					}
				}
			}
		}
		userGroupRatio[ur.Id] = ratios
	}

	groupDiscounts := make(map[string]float64)
	groupDiscountSum := make(map[string]float64)
	groupDiscountCount := make(map[string]int64)
	for _, ugc := range userGroupCounts {
		ratios := userGroupRatio[ugc.UserId]
		ratio, ok := ratios[ugc.Group]
		if !ok || ratio <= 0 {
			ratio = 1.0
		}
		groupDiscountSum[ugc.Group] += ratio * float64(ugc.ReqCount)
		groupDiscountCount[ugc.Group] += ugc.ReqCount
	}
	for g, cnt := range groupDiscountCount {
		if cnt > 0 {
			groupDiscounts[g] = groupDiscountSum[g] / float64(cnt)
		} else {
			groupDiscounts[g] = 1.0
		}
	}

	for cg, gd := range clawdGroups {
		var discountSum float64
		var totalCount int64
		for groupName, count := range gd.groupCounts {
			discountSum += groupDiscounts[groupName] * float64(count)
			totalCount += count
		}
		avgUserRatio := 1.0
		if totalCount > 0 {
			avgUserRatio = discountSum / float64(totalCount)
		}

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