package model

import (
	"github.com/QuantumNous/new-api/common"
)

func GetWatchedChannels() ([]*Channel, error) {
	var channels []*Channel
	err := DB.Omit("key").Find(&channels).Error
	if err != nil {
		return nil, err
	}
	watched := make([]*Channel, 0, len(channels))
	for _, ch := range channels {
		if ch.ChannelInfo.ClawdGroup > 0 {
			watched = append(watched, ch)
		}
	}
	return watched, nil
}

func SetChannelClawdGroup(channelId int, group int) error {
	ch, err := GetChannelById(channelId, true)
	if err != nil {
		return err
	}
	ch.ChannelInfo.ClawdGroup = group
	if group == 0 {
		ch.ChannelInfo.ClawdScore = 0
		ch.ChannelInfo.ClawdScoreFormula = ""
		ch.ChannelInfo.ClawdScoreBreakdownJSON = ""
		ch.ChannelInfo.ClawdTuneReason = ""
		ch.ChannelInfo.ClawdInObservation = false
		ch.ChannelInfo.ClawdObservationUntil = 0
		ch.ChannelInfo.ClawdConsecutiveDrops = 0
	}
	infoBytes, err := common.Marshal(&ch.ChannelInfo)
	if err != nil {
		return err
	}
	return DB.Model(&Channel{}).Where("id = ?", channelId).
		Update("channel_info", string(infoBytes)).Error
}

type ChannelScoreUpdate struct {
	Score              float64
	ScoreFormula       string
	ScoreBreakdownJSON string
	LastTuneAt         int64
	TuneReason         string
	ConsecutiveDrops   int
	InObservation      bool
	ObservationUntil   int64
}

func UpdateChannelClawdScore(channelId int, update ChannelScoreUpdate) error {
	ch, err := GetChannelById(channelId, true)
	if err != nil {
		return err
	}
	ch.ChannelInfo.ClawdScore = update.Score
	ch.ChannelInfo.ClawdScoreFormula = update.ScoreFormula
	ch.ChannelInfo.ClawdScoreBreakdownJSON = update.ScoreBreakdownJSON
	if update.LastTuneAt > 0 {
		ch.ChannelInfo.ClawdLastTuneAt = update.LastTuneAt
	}
	ch.ChannelInfo.ClawdTuneReason = update.TuneReason
	ch.ChannelInfo.ClawdConsecutiveDrops = update.ConsecutiveDrops
	ch.ChannelInfo.ClawdInObservation = update.InObservation
	ch.ChannelInfo.ClawdObservationUntil = update.ObservationUntil
	infoBytes, err := common.Marshal(&ch.ChannelInfo)
	if err != nil {
		return err
	}
	return DB.Model(&Channel{}).Where("id = ?", channelId).
		Update("channel_info", string(infoBytes)).Error
}

type ChannelPriorityUpdate struct {
	ChannelId   int
	OldPriority int64
	NewPriority int64
}

func UpdateChannelPriority(channelId int, newPriority int64) error {
	ch, err := GetChannelById(channelId, true)
	if err != nil {
		return err
	}
	oldPriority := ch.GetPriority()
	if oldPriority == newPriority {
		return nil
	}
	priorityPtr := newPriority
	err = DB.Model(&Channel{}).Where("id = ?", channelId).
		Update("priority", priorityPtr).Error
	if err != nil {
		return err
	}
	ch.Priority = &newPriority
	return ch.UpdateAbilities(nil)
}

func GetChannelPriority(channelId int) (int64, error) {
	ch, err := GetChannelById(channelId, false)
	if err != nil {
		return 0, err
	}
	return ch.GetPriority(), nil
}

