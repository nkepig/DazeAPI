package pricing

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
)

// ModelPricing holds dollar-based pricing for a model.
// All token prices are in USD per 1M tokens.
// PerCallPrice is in USD per call (only when UsePerCallPricing=true).
//
// Conversion from old ratio system:
//
//	promptPrice     = modelRatio × 2
//	completionPrice = modelRatio × completionRatio × 2
//	cacheReadPrice  = modelRatio × cacheRatio × 2
//	cacheWritePrice = modelRatio × cacheCreationRatio × 2
type ModelPricing struct {
	PromptPrice      float64 `json:"prompt_price"`
	CompletionPrice   float64 `json:"completion_price"`
	CacheReadPrice    float64 `json:"cache_read_price,omitempty"`
	CacheWritePrice   float64 `json:"cache_write_price,omitempty"`
	ImagePrice        float64 `json:"image_price,omitempty"`
	AudioInputPrice   float64 `json:"audio_input_price,omitempty"`
	AudioOutputPrice  float64 `json:"audio_output_price,omitempty"`
	PerCallPrice      float64 `json:"per_call_price,omitempty"`
	UsePerCallPricing bool    `json:"use_per_call_pricing,omitempty"`
}

const MicrodollarsPerDollar int64 = 1_000_000

func ToMicrodollars(dollars float64) int64 {
	return int64(dollars * float64(MicrodollarsPerDollar))
}

func ToDollars(microdollars int64) float64 {
	return float64(microdollars) / float64(MicrodollarsPerDollar)
}

func FormatDollars(microdollars int64) string {
	return FormatDollarAmount(ToDollars(microdollars))
}

func FormatDollarAmount(dollars float64) string {
	if dollars == 0 {
		return "$0.000000"
	}
	return fmt.Sprintf("$%.6f", dollars)
}

var (
	modelPricingMap       = types.NewRWMap[string, ModelPricing]()
	groupDiscountMap       = types.NewRWMap[string, float64]()
	groupModelDiscountMap = types.NewRWMap[string, map[string]float64]()
)

func InitPricingSettings() {
	modelPricingMap.AddAll(defaultModelPricing)
	groupDiscountMap.AddAll(defaultGroupDiscount)
	groupModelDiscountMap.AddAll(defaultGroupModelDiscount)
}

func GetModelPricing(name string) (ModelPricing, bool) {
	name = FormatMatchingModelName(name)
	pricing, ok := modelPricingMap.Get(name)
	if !ok {
		if strings.HasSuffix(name, CompactModelSuffix) {
			if wildcardPricing, ok := modelPricingMap.Get(CompactWildcardModelKey); ok {
				return wildcardPricing, true
			}
		}
		return ModelPricing{}, false
	}
	return pricing, true
}

func GetModelPricingMap() map[string]ModelPricing {
	return modelPricingMap.ReadAll()
}

func ModelPricing2JSONString() string {
	return modelPricingMap.MarshalJSONString()
}

func UpdateModelPricingByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelPricingMap, jsonStr, func() {})
}

func UpdateExposedModelPricingByJSONString(jsonStr string) error {
	incoming := make(map[string]ModelPricing)
	if err := common.UnmarshalJsonStr(jsonStr, &incoming); err != nil {
		return err
	}

	next := make(map[string]ModelPricing, len(defaultModelPricing)+len(incoming))
	for name, value := range defaultModelPricing {
		next[name] = value
	}

	for name, value := range incoming {
		formattedName := FormatMatchingModelName(name)
		if strings.TrimSpace(formattedName) == "" {
			continue
		}
		next[formattedName] = value
	}

	modelPricingMap.Clear()
	modelPricingMap.AddAll(next)
	return nil
}

func GetGroupDiscount(group string) float64 {
	return ratio_setting.GetGroupRatio(group)
}

func GetGroupModelDiscount(userGroup, model string) (float64, bool) {
	modelDiscounts, ok := groupModelDiscountMap.Get(userGroup)
	if !ok {
		return -1, false
	}
	discount, ok := modelDiscounts[model]
	if !ok {
		return -1, false
	}
	return discount, true
}

func GetGroupDiscountCopy() map[string]float64 {
	return groupDiscountMap.ReadAll()
}

func GetGroupModelDiscountCopy() map[string]map[string]float64 {
	result := make(map[string]map[string]float64)
	for k, v := range groupModelDiscountMap.ReadAll() {
		result[k] = v
	}
	return result
}

func GroupDiscount2JSONString() string {
	return groupDiscountMap.MarshalJSONString()
}

func UpdateGroupDiscountByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(groupDiscountMap, jsonStr, func() {})
}

func GroupModelDiscount2JSONString() string {
	return groupModelDiscountMap.MarshalJSONString()
}

func UpdateGroupModelDiscountByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(groupModelDiscountMap, jsonStr, func() {})
}

func IsModelConfigured(name string) bool {
	name = FormatMatchingModelName(name)
	if _, ok := modelPricingMap.Get(name); ok {
		return true
	}
	if strings.HasSuffix(name, CompactModelSuffix) {
		if _, ok := modelPricingMap.Get(CompactWildcardModelKey); ok {
			return true
		}
	}
	return false
}

func GetModelPricingCopy() map[string]ModelPricing {
	return modelPricingMap.ReadAll()
}

const USD = 500.0

func ContainsGroupDiscount(name string) bool {
	return ratio_setting.ContainsGroupRatio(name)
}

func ContainsGroupRatio(name string) bool {
	return ContainsGroupDiscount(name)
}

func GetExposedData() map[string]interface{} {
	return map[string]interface{}{
		"model_pricing":         GetModelPricingMap(),
		"group_discount":        GetGroupDiscountCopy(),
		"group_model_discount":  GetGroupModelDiscountCopy(),
	}
}
