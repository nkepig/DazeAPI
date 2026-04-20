package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			for specialGroup, desc := range specialSettings {
				if strings.HasPrefix(specialGroup, "-:") {
					groupToRemove := strings.TrimPrefix(specialGroup, "-:")
					delete(groupsCopy, groupToRemove)
				} else if strings.HasPrefix(specialGroup, "+:") {
					groupToAdd := strings.TrimPrefix(specialGroup, "+:")
					groupsCopy[groupToAdd] = desc
				} else {
					groupsCopy[specialGroup] = desc
				}
			}
		}
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	return groupsCopy
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func GetUserAutoGroup(userGroup string) []string {
	groups := GetUserUsableGroups(userGroup)
	autoGroups := make([]string, 0)
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; ok {
			autoGroups = append(autoGroups, group)
		}
	}
	return autoGroups
}
func splitChannelGroups(groupStr string) []string {
	parts := strings.Split(groupStr, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func GroupExistsInChannels(groupName string) bool {
	groupName = strings.TrimSpace(groupName)
	if groupName == "" {
		return false
	}
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return false
	}
	for _, ch := range channels {
		for _, g := range splitChannelGroups(ch.Group) {
			if g == groupName {
				return true
			}
		}
	}
	return false
}

func GetUserAccessibleChannelGroups(userGroup string) map[string]string {
	usable := GetUserUsableGroups(userGroup)
	filtered := make(map[string]string)
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return filtered
	}
	for _, ch := range channels {
		for _, g := range splitChannelGroups(ch.Group) {
			if desc, ok := usable[g]; ok {
				filtered[g] = desc
			}
		}
		}
	return filtered
}

func HasAccessibleModelInGroup(userGroup, tokenGroup string) bool {
	if strings.TrimSpace(tokenGroup) == "" {
		return false
	}
	if _, ok := GetUserAccessibleChannelGroups(userGroup)[tokenGroup]; !ok {
		return false
	}
	models := model.GetGroupEnabledModels(tokenGroup)
	return len(models) > 0
}

func GetUserAccessibleChannelGroupsByRatio(groupRatio map[string]float64) map[string]string {
	filtered := make(map[string]string)
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return filtered
	}
	for _, ch := range channels {
		for _, g := range splitChannelGroups(ch.Group) {
			if _, ok := groupRatio[g]; ok {
				filtered[g] = g
			}
		}
	}
	return filtered
}

func HasAccessibleModelInGroupByRatio(groupRatio map[string]float64, tokenGroup string) bool {
	if strings.TrimSpace(tokenGroup) == "" {
		return false
	}
	if _, ok := GetUserAccessibleChannelGroupsByRatio(groupRatio)[tokenGroup]; !ok {
		return false
	}
	models := model.GetGroupEnabledModels(tokenGroup)
	return len(models) > 0
}

func GetUserAccessibleModelsByRatio(groupRatio map[string]float64) []string {
	modelSet := make(map[string]struct{})
	for group := range GetUserAccessibleChannelGroupsByRatio(groupRatio) {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			modelSet[modelName] = struct{}{}
		}
	}
	models := make([]string, 0, len(modelSet))
	for modelName := range modelSet {
		models = append(models, modelName)
	}
	return models
}
