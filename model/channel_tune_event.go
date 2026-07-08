package model

import (
	"github.com/QuantumNous/new-api/common"
)

type ChannelTuneEvent struct {
	Id          int64   `json:"id" gorm:"primaryKey;autoIncrement"`
	ChannelId   int     `json:"channel_id" gorm:"index"`
	ChannelName string  `json:"channel_name"`
	Group       string  `json:"group"`
	ClawdGroup  int     `json:"clawd_group"`
	OldPriority int64   `json:"old_priority"`
	NewPriority int64   `json:"new_priority"`
	OldScore    float64 `json:"old_score"`
	NewScore    float64 `json:"new_score"`
	Reason      string  `json:"reason"`
	Trigger     string  `json:"trigger"`
	CreatedAt   int64   `json:"created_at" gorm:"index"`
}

func (ChannelTuneEvent) TableName() string {
	return "channel_tune_events"
}

func InitChannelTuneEventTable() {
	err := DB.AutoMigrate(&ChannelTuneEvent{})
	if err != nil {
		common.SysError("failed to migrate channel_tune_events table: " + err.Error())
	}
}

func RecordChannelTuneEvent(event *ChannelTuneEvent) error {
	if event.CreatedAt == 0 {
		event.CreatedAt = common.GetTimestamp()
	}
	return DB.Create(event).Error
}

func GetChannelTuneEvents(channelId int, limit int, offset int) ([]*ChannelTuneEvent, int64, error) {
	var events []*ChannelTuneEvent
	var total int64

	query := DB.Model(&ChannelTuneEvent{})
	if channelId > 0 {
		query = query.Where("channel_id = ?", channelId)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&events).Error
	return events, total, err
}

func ClearAllChannelTuneEvents() error {
	return DB.Where("1 = 1").Delete(&ChannelTuneEvent{}).Error
}

func ResetAllWatchedChannelBaseline() error {
	channels, err := GetWatchedChannels()
	if err != nil {
		return err
	}
	for _, ch := range channels {
		ch.ChannelInfo.ClawdConsecutiveDrops = 0
		ch.ChannelInfo.ClawdInObservation = false
		ch.ChannelInfo.ClawdObservationUntil = 0
		ch.ChannelInfo.ClawdTuneReason = ""
		ch.ChannelInfo.ClawdLastTuneAt = 0
		infoBytes, mErr := common.Marshal(&ch.ChannelInfo)
		if mErr != nil {
			continue
		}
		if uErr := DB.Model(&Channel{}).Where("id = ?", ch.Id).
			Update("channel_info", string(infoBytes)).Error; uErr != nil {
			common.SysError("ResetAllWatchedChannelBaseline: update channel_info failed: " + uErr.Error())
		}
	}
	return nil
}
