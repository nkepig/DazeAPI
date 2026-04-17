package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func splitGroups(groupStr string) []string {
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

func GetAllChannelGroups() []string {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return []string{}
	}
	seen := make(map[string]bool)
	groupNames := make([]string, 0)
	for _, ch := range channels {
		if ch.Group == "" {
			continue
		}
		for _, g := range splitGroups(ch.Group) {
			if g != "" && !seen[g] {
				seen[g] = true
				groupNames = append(groupNames, g)
			}
		}
	}
	return groupNames
}

func GetGroups(c *gin.Context) {
	groupNames := GetAllChannelGroups()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	channelGroups := GetAllChannelGroups()
	userId := c.GetInt("id")
	userGroupRatio := map[string]float64{}
	if userId > 0 {
		user, err := model.GetUserCache(userId)
		if err == nil {
			userGroupRatio = user.GetGroupRatioMap()
		}
	}

	usableGroups := make(map[string]map[string]interface{})
	for _, groupName := range channelGroups {
		ratio := 1.0
		if r, ok := userGroupRatio[groupName]; ok {
			ratio = r
		}
		usableGroups[groupName] = map[string]interface{}{
			"ratio": ratio,
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}