package model

func GetModelEnableGroups(modelName string) []string {
	// 确保缓存最新
	GetPricing()

	if modelName == "" {
		return make([]string, 0)
	}

	modelEnableGroupsLock.RLock()
	groups, ok := modelEnableGroups[modelName]
	modelEnableGroupsLock.RUnlock()
	if !ok {
		return make([]string, 0)
	}
	return groups
}

// GetModelPricingType 返回指定模型的计费类型（来自缓存）
func GetModelPricingType(modelName string) int {
	GetPricing()

	modelEnableGroupsLock.RLock()
	pricingType, ok := modelPricingTypeMap[modelName]
	modelEnableGroupsLock.RUnlock()
	if !ok {
		return 0
	}
	return pricingType
}
