package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/pricing"

	"github.com/gin-gonic/gin"
)

func GetPricing(c *gin.Context) {
	pricingList := model.GetPricing()
	userId, exists := c.Get("id")
	groupDiscount := map[string]float64{}
	var group string
	var userGroupRatio map[string]float64
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			userGroupRatio = user.GetGroupRatioMap()
			if len(userGroupRatio) > 0 {
				for g, r := range userGroupRatio {
					groupDiscount[g] = r
				}
			}
		}
	}

	// Filter models based on user's group_ratio
	// Only show models whose enable_groups intersect with user's configured groups
	filteredPricingList := make([]model.Pricing, 0)
	userGroups := make(map[string]bool)
	for g := range userGroupRatio {
		userGroups[g] = true
	}

	for _, p := range pricingList {
		// If user has no group_ratio configured (empty), show all models
		if len(userGroupRatio) == 0 {
			filteredPricingList = append(filteredPricingList, p)
			continue
		}

		// Check if model's enable_groups intersects with user's groups
		modelGroups := p.EnableGroup
		if len(modelGroups) == 0 {
			// Model has no group restriction, show it
			filteredPricingList = append(filteredPricingList, p)
			continue
		}

		// Check intersection
		hasIntersection := false
		for _, mg := range modelGroups {
			if userGroups[mg] {
				hasIntersection = true
				break
			}
		}

		if hasIntersection {
			filteredPricingList = append(filteredPricingList, p)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               filteredPricingList,
		"vendors":            model.GetVendors(),
		"group_discount":     groupDiscount,
		"user_group":         group,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"_":                  "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := pricing.ModelPricing2JSONString()
	err := model.UpdateOption("ModelPricing", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = pricing.UpdateModelPricingByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型定价成功",
	})
}
