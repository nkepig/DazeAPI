package controller

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	var group string
	var userOverrides map[string]dto.UserModelOverride
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
			userSetting := user.GetSetting()
			if len(userSetting.ModelOverrides) > 0 {
				userOverrides = userSetting.ModelOverrides
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	// apply user-level model overrides: filter to whitelist, attach user_multiplier
	if userOverrides != nil {
		filtered := make([]model.Pricing, 0, len(userOverrides))
		for i := range pricing {
			p := pricing[i]
			if override, ok := userOverrides[p.ModelName]; ok {
				if override.BillingType == "price" {
					p.QuotaType = 1
					p.ModelPrice = override.Value
					p.ModelRatio = 0
				} else {
					v := override.Value
					p.UserMultiplier = &v
				}
				filtered = append(filtered, p)
			}
		}
		existingModels := make(map[string]bool, len(filtered))
		for _, p := range filtered {
			existingModels[p.ModelName] = true
		}
		for modelName, override := range userOverrides {
			if existingModels[modelName] {
				continue
			}
			p := model.Pricing{ModelName: modelName}
			if override.BillingType == "price" {
				p.QuotaType = 1
				p.ModelPrice = override.Value
			} else {
				v := override.Value
				p.UserMultiplier = &v
			}
			filtered = append(filtered, p)
		}
		pricing = filtered
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"_":                  "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
