package service

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type ClawdEventBus struct {
	mu          sync.RWMutex
	subscribers map[chan model.ChannelTuneEvent]struct{}
}

var clawdBus = &ClawdEventBus{
	subscribers: make(map[chan model.ChannelTuneEvent]struct{}),
}

func GetClawdEventBus() *ClawdEventBus {
	return clawdBus
}

func (b *ClawdEventBus) Subscribe() chan model.ChannelTuneEvent {
	ch := make(chan model.ChannelTuneEvent, 16)
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscribers[ch] = struct{}{}
	return ch
}

func (b *ClawdEventBus) Unsubscribe(ch chan model.ChannelTuneEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.subscribers[ch]; ok {
		delete(b.subscribers, ch)
		close(ch)
	}
}

func (b *ClawdEventBus) Publish(event model.ChannelTuneEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

var clawdTuneOnce sync.Once

func StartClawdScheduler() {
	if !common.IsMasterNode {
		return
	}
	clawdTuneOnce.Do(func() {
		for {
			cfg := operation_setting.GetClawdSetting()
			if !cfg.Enabled {
				time.Sleep(1 * time.Minute)
				continue
			}
			interval := time.Duration(cfg.WatchIntervalSeconds) * time.Second
			if interval < time.Minute {
				interval = time.Minute
			}
			time.Sleep(interval)
			if !operation_setting.GetClawdSetting().Enabled {
				continue
			}
			runClawdTuneCycle()
		}
	})
}

func runClawdTuneCycle() {
	cfg := operation_setting.GetClawdSetting()
	common.SysLog("Clawd: starting tune cycle")

	groupStats, err := ComputeChannelScores(int64(cfg.WindowSeconds))
	if err != nil {
		common.SysError("Clawd: compute scores failed: " + err.Error())
		return
	}

	now := time.Now().Unix()
	for clawdGroup, stats := range groupStats {
		if len(stats.Channels) < 2 {
			continue
		}

		totalSample := 0
		for _, ch := range stats.Channels {
			totalSample += ch.SampleCount
		}
		if totalSample < cfg.MinSampleSize {
			common.SysLog(fmt.Sprintf("Clawd: group=%s total samples=%d < min=%d, skip",
				clawdGroup, totalSample, cfg.MinSampleSize))
			continue
		}

		for _, ch := range stats.Channels {
			breakdownJSON := BuildScoreBreakdownJSON(ch, clawdGroup)
			scoreUpdate := model.ChannelScoreUpdate{
				Score:              ch.Score,
				ScoreFormula:       ch.ScoreFormula,
				ScoreBreakdownJSON: breakdownJSON,
			}
			if err := model.UpdateChannelClawdScore(ch.ChannelId, scoreUpdate); err != nil {
				common.SysError(fmt.Sprintf("Clawd: update score failed channel=%d: %v", ch.ChannelId, err))
			}
		}

		sorted := make([]ChannelScore, len(stats.Channels))
		copy(sorted, stats.Channels)
		sort.SliceStable(sorted, func(i, j int) bool {
			return sorted[i].Score > sorted[j].Score
		})

		// 收集组内所有渠道的现有 priority，降序排列
		type chWithPriority struct {
			Score    ChannelScore
			Priority int64
		}
		withPriorities := make([]chWithPriority, 0, len(sorted))
		for _, ch := range sorted {
			orig, err := model.GetChannelById(ch.ChannelId, true)
			if err != nil {
				continue
			}
			withPriorities = append(withPriorities, chWithPriority{
				Score:    ch,
				Priority: orig.GetPriority(),
			})
		}
		if len(withPriorities) == 0 {
			continue
		}

		// 收集现有 priority 值并降序排列，分数最高的渠道拿最高的现有 priority
		priorities := make([]int64, len(withPriorities))
		for i, wp := range withPriorities {
			priorities[i] = wp.Priority
		}
		sort.Slice(priorities, func(i, j int) bool {
			return priorities[i] > priorities[j]
		})

		for rank, wp := range withPriorities {
			ch := wp.Score
			oldPriority := wp.Priority
			newPriority := priorities[rank]

			if wp.Score.ChannelId == 0 {
				continue
			}

			orig, err := model.GetChannelById(ch.ChannelId, true)
			if err != nil {
				continue
			}
			if orig.ChannelInfo.ClawdInObservation && now < orig.ChannelInfo.ClawdObservationUntil {
				continue
			}
			if oldPriority == newPriority {
				continue
			}

			if err := model.UpdateChannelPriority(ch.ChannelId, newPriority); err != nil {
				common.SysError(fmt.Sprintf("Clawd: set priority failed channel=%d: %v", ch.ChannelId, err))
				continue
			}

			reason := fmt.Sprintf("按分数排序: %.1f 分 → 优先级 %d", ch.Score, newPriority)
			update := model.ChannelScoreUpdate{
				Score:              ch.Score,
				ScoreFormula:       ch.ScoreFormula,
				ScoreBreakdownJSON: BuildScoreBreakdownJSON(ch, clawdGroup),
				LastTuneAt:         now,
				TuneReason:         reason,
			}
			_ = model.UpdateChannelClawdScore(ch.ChannelId, update)

			event := model.ChannelTuneEvent{
				ChannelId:   ch.ChannelId,
				ChannelName: ch.ChannelName,
				Group:       ch.Group,
				ClawdGroup:  clawdGroup,
				OldPriority: oldPriority,
				NewPriority: newPriority,
				OldScore:    ch.Score,
				NewScore:    ch.Score,
				Reason:      reason,
				Trigger:     "clawd",
				CreatedAt:   now,
			}
			_ = model.RecordChannelTuneEvent(&event)
			GetClawdEventBus().Publish(event)

			common.SysLog(fmt.Sprintf("Clawd: rank channel=%d (%s) priority %d → %d, score=%.1f",
				ch.ChannelId, ch.ChannelName, oldPriority, newPriority, ch.Score))
		}
	}

	common.SysLog("Clawd: tune cycle finished")
}

func PublishManualTuneEvent(channelId int, oldPriority, newPriority int64, reason string) {
	channelName := ""
	if ch, err := model.GetChannelById(channelId, false); err == nil {
		channelName = ch.Name
	}
	event := model.ChannelTuneEvent{
		ChannelId:   channelId,
		ChannelName: channelName,
		OldPriority: oldPriority,
		NewPriority: newPriority,
		Reason:      reason,
		Trigger:     "clawd",
		CreatedAt:   time.Now().Unix(),
	}
	GetClawdEventBus().Publish(event)
}
