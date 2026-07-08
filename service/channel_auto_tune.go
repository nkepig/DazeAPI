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
			common.SysLog(fmt.Sprintf("Clawd: group=%d total samples=%d < min=%d, skip",
				clawdGroup, totalSample, cfg.MinSampleSize))
			continue
		}

		problemChannels := make([]ChannelScore, 0)
		healthyChannels := make([]ChannelScore, 0)

		for i := range stats.Channels {
			ch := stats.Channels[i]
			isProblem, _ := IsProblemChannel(ch, stats)
			if isProblem {
				clone := ch
				problemChannels = append(problemChannels, clone)
			} else {
				healthyChannels = append(healthyChannels, ch)
			}
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

		sortedHealthy := make([]ChannelScore, len(healthyChannels))
		copy(sortedHealthy, healthyChannels)
		sort.Slice(sortedHealthy, func(i, j int) bool {
			return sortedHealthy[i].Score > sortedHealthy[j].Score
		})

		for _, problemCh := range problemChannels {
			original, err := model.GetChannelById(problemCh.ChannelId, true)
			if err != nil {
				continue
			}
			oldPriority := original.GetPriority()

			if original.ChannelInfo.ClawdInObservation && now < original.ChannelInfo.ClawdObservationUntil {
				continue
			}

			var swapTarget *ChannelScore
			for i := range sortedHealthy {
				c := sortedHealthy[i]
				orig, err := model.GetChannelById(c.ChannelId, true)
				if err != nil {
					continue
				}
				tp := orig.GetPriority()
				if tp < oldPriority {
					swapTarget = &c
					break
				}
			}

			if swapTarget == nil {
				continue
			}

			swapOriginal, err := model.GetChannelById(swapTarget.ChannelId, true)
			if err != nil {
				continue
			}
			swapOldPriority := swapOriginal.GetPriority()

			if err := model.UpdateChannelPriority(problemCh.ChannelId, swapOldPriority); err != nil {
				common.SysError(fmt.Sprintf("Clawd: swap down failed channel=%d: %v", problemCh.ChannelId, err))
				continue
			}
			if err := model.UpdateChannelPriority(swapTarget.ChannelId, oldPriority); err != nil {
				common.SysError(fmt.Sprintf("Clawd: swap up failed channel=%d: %v", swapTarget.ChannelId, err))
				_ = model.UpdateChannelPriority(problemCh.ChannelId, oldPriority)
				continue
			}

			_, reason := IsProblemChannel(problemCh, stats)

			consecutiveDrops := original.ChannelInfo.ClawdConsecutiveDrops + 1
			inObservation := false
			observationUntil := int64(0)
			if consecutiveDrops >= cfg.ObservationCount {
				inObservation = true
				observationUntil = now + int64(cfg.ObservationSeconds)
			}

			problemUpdate := model.ChannelScoreUpdate{
				Score:              problemCh.Score,
				ScoreFormula:       problemCh.ScoreFormula,
				ScoreBreakdownJSON: BuildScoreBreakdownJSON(problemCh, clawdGroup),
				LastTuneAt:         now,
				TuneReason:         reason,
				ConsecutiveDrops:   consecutiveDrops,
				InObservation:      inObservation,
				ObservationUntil:   observationUntil,
			}
			_ = model.UpdateChannelClawdScore(problemCh.ChannelId, problemUpdate)

			swapUpdate := model.ChannelScoreUpdate{
				Score:              swapTarget.Score,
				ScoreFormula:       swapTarget.ScoreFormula,
				ScoreBreakdownJSON: BuildScoreBreakdownJSON(*swapTarget, clawdGroup),
				LastTuneAt:         now,
				TuneReason:         "与问题渠道交换 priority",
			}
			_ = model.UpdateChannelClawdScore(swapTarget.ChannelId, swapUpdate)

			event := model.ChannelTuneEvent{
				ChannelId:   problemCh.ChannelId,
				ChannelName: problemCh.ChannelName,
				Group:       problemCh.Group,
				ClawdGroup:  clawdGroup,
				OldPriority: oldPriority,
				NewPriority: swapOldPriority,
				OldScore:    problemCh.Score,
				NewScore:    problemCh.Score,
				Reason:      reason,
				Trigger:     "clawd",
				CreatedAt:   now,
			}
			_ = model.RecordChannelTuneEvent(&event)
			GetClawdEventBus().Publish(event)

			swapEvent := model.ChannelTuneEvent{
				ChannelId:   swapTarget.ChannelId,
				ChannelName: swapTarget.ChannelName,
				Group:       swapTarget.Group,
				ClawdGroup:  clawdGroup,
				OldPriority: swapOldPriority,
				NewPriority: oldPriority,
				OldScore:    swapTarget.Score,
				NewScore:    swapTarget.Score,
				Reason:      "与问题渠道交换 priority",
				Trigger:     "clawd",
				CreatedAt:   now,
			}
			_ = model.RecordChannelTuneEvent(&swapEvent)
			GetClawdEventBus().Publish(swapEvent)

			common.SysLog(fmt.Sprintf("Clawd: swap channel=%d (%s) priority %d ↔ channel=%d (%s) priority %d, reason: %s",
				problemCh.ChannelId, problemCh.ChannelName, oldPriority,
				swapTarget.ChannelId, swapTarget.ChannelName, swapOldPriority, reason))
		}
	}

	common.SysLog("Clawd: tune cycle finished")
}

func PublishManualTuneEvent(channelId int, oldPriority, newPriority int64, reason string) {
	event := model.ChannelTuneEvent{
		ChannelId:   channelId,
		OldPriority: oldPriority,
		NewPriority: newPriority,
		Reason:      reason,
		Trigger:     "clawd",
		CreatedAt:   time.Now().Unix(),
	}
	GetClawdEventBus().Publish(event)
}
