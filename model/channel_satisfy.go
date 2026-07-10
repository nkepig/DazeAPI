package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func IsChannelEnabledForGroupModel(group string, modelName string, channelID int) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	if group2model2channels == nil {
		return false
	}

	if isChannelIDInList(group2model2channels[group][modelName], channelID) {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized != "" && normalized != modelName {
		return isChannelIDInList(group2model2channels[group][normalized], channelID)
	}
	return false
}

// ResolveChannelBillingGroup 返回该渠道上实际承载 modelName 的分组名，用于选路后将 UsingGroup 与 groupratio 的 key 对齐。
func ResolveChannelBillingGroup(channel *Channel, modelName string) string {
	if channel == nil {
		return ""
	}
	if strings.TrimSpace(modelName) != "" {
		for _, raw := range strings.Split(channel.Group, ",") {
			g := NormalizeGroupField(raw)
			if g == "" {
				continue
			}
			if IsChannelEnabledForGroupModel(g, modelName, channel.Id) {
				return g
			}
		}
	}
	for _, raw := range strings.Split(channel.Group, ",") {
		g := NormalizeGroupField(raw)
		if g != "" {
			return g
		}
	}
	return ""
}

func isChannelEnabledForGroupModelDB(group string, modelName string, channelID int) bool {
	var count int64
	err := DB.Model(&Ability{}).
		Where("\"group\""+" = ? and model = ? and channel_id = ? and enabled = ?", group, modelName, channelID, true).
		Count(&count).Error
	if err == nil && count > 0 {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized == "" || normalized == modelName {
		return false
	}
	count = 0
	err = DB.Model(&Ability{}).
		Where("\"group\""+" = ? and model = ? and channel_id = ? and enabled = ?", group, normalized, channelID, true).
		Count(&count).Error
	return err == nil && count > 0
}

func isChannelIDInList(list []int, channelID int) bool {
	for _, id := range list {
		if id == channelID {
			return true
		}
	}
	return false
}
