package helper

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/pricing"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const claudeCacheCreation1hMultiplier = 6.0 / 3.75

func getUserModelOverride(info *relaycommon.RelayInfo, modelName string) (dto.UserModelOverride, bool) {
	overrides := info.UserSetting.ModelOverrides
	if len(overrides) == 0 {
		return dto.UserModelOverride{}, false
	}
	if o, ok := overrides[modelName]; ok {
		return o, true
	}
	if o, ok := overrides[info.OriginModelName]; ok {
		return o, true
	}
	return dto.UserModelOverride{}, false
}

func applyUserOverride(info *relaycommon.RelayInfo, modelName string, modelPricing *pricing.ModelPricing, groupDiscountInfo *types.GroupDiscountInfo) {
	o, ok := getUserModelOverride(info, modelName)
	if !ok {
		return
	}
	if o.BillingType == "price" {
		modelPricing.PerCallPrice = o.Value
		modelPricing.UsePerCallPricing = true
		modelPricing.PromptPrice = 0
		modelPricing.CompletionPrice = 0
		modelPricing.CacheReadPrice = 0
		modelPricing.CacheWritePrice = 0
		groupDiscountInfo.GroupDiscount = 1.0
	} else {
		groupDiscountInfo.GroupDiscount = o.Value
	}
}

func HandleGroupRatio(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) types.GroupDiscountInfo {
	groupDiscountInfo := types.GroupDiscountInfo{
		GroupDiscount:     1.0,
		GroupSpecialRatio: -1,
	}

	autoGroup, exists := ctx.Get("auto_group")
	if exists {
		logger.LogDebug(ctx, fmt.Sprintf("final group: %s", autoGroup))
		relayInfo.UsingGroup = autoGroup.(string)
	}

	discount, ok := pricing.GetGroupModelDiscount(relayInfo.UserGroup, relayInfo.OriginModelName)
	if ok {
		groupDiscountInfo.GroupSpecialRatio = discount
		groupDiscountInfo.GroupDiscount = discount
		groupDiscountInfo.HasSpecialRatio = true
	} else {
		userGroupRatio := relayInfo.UserGroupRatio
		if ratio, ratioOk := userGroupRatio[relayInfo.UsingGroup]; ratioOk {
			groupDiscountInfo.GroupDiscount = ratio
		}
	}

	return groupDiscountInfo
}

func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (types.PriceData, error) {
	modelName := pricing.FormatMatchingModelName(info.OriginModelName)

	groupDiscountInfo := HandleGroupRatio(c, info)

	modelPricing, found := pricing.GetModelPricing(info.OriginModelName)
	if !found {
		return types.PriceData{}, fmt.Errorf("model pricing not found: %s", info.OriginModelName)
	}

	applyUserOverride(info, modelName, &modelPricing, &groupDiscountInfo)

	var preConsumedQuota int
	var freeModel bool

	if !modelPricing.UsePerCallPricing {
		preConsumedTokens := common.Max(promptTokens, common.PreConsumedQuota)
		if meta.MaxTokens != 0 {
			preConsumedTokens += meta.MaxTokens
		}
		estimatedCostMicrodollars := pricing.ToMicrodollars(
			float64(preConsumedTokens)/1_000_000.0*modelPricing.PromptPrice +
				float64(common.Max(meta.MaxTokens, 0))/1_000_000.0*modelPricing.CompletionPrice,
		)
		preConsumedQuota = int(float64(estimatedCostMicrodollars) * groupDiscountInfo.GroupDiscount)
		if meta.ImagePriceRatio != 0 && modelPricing.ImagePrice == 0 {
			modelPricing.ImagePrice = modelPricing.PromptPrice * meta.ImagePriceRatio
		}
	} else {
		if meta.ImagePriceRatio != 0 {
			modelPricing.PerCallPrice = modelPricing.PerCallPrice * meta.ImagePriceRatio
		}
		preConsumedQuota = int(modelPricing.PerCallPrice * float64(common.MicrodollarsPerUnit) * groupDiscountInfo.GroupDiscount)
	}

	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupDiscountInfo.GroupDiscount == 0 {
			preConsumedQuota = 0
			freeModel = true
		} else if modelPricing.UsePerCallPricing {
			if modelPricing.PerCallPrice == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		} else {
			if modelPricing.PromptPrice == 0 && modelPricing.CompletionPrice == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		}
	}

	cacheWrite5m := modelPricing.CacheWritePrice
	cacheWrite1h := modelPricing.CacheWritePrice * claudeCacheCreation1hMultiplier

	priceData := types.PriceData{
		FreeModel:            freeModel,
		PromptPrice:         modelPricing.PromptPrice,
		CompletionPrice:     modelPricing.CompletionPrice,
		CacheReadPrice:      modelPricing.CacheReadPrice,
		CacheWritePrice:     modelPricing.CacheWritePrice,
		CacheWrite5mPrice:   cacheWrite5m,
		CacheWrite1hPrice:   cacheWrite1h,
		ImagePrice:          modelPricing.ImagePrice,
		AudioInputPrice:     modelPricing.AudioInputPrice,
		AudioOutputPrice:    modelPricing.AudioOutputPrice,
		PerCallPrice:        modelPricing.PerCallPrice,
		UsePerCallPricing:   modelPricing.UsePerCallPricing,
		GroupDiscountInfo:   groupDiscountInfo,
		QuotaToPreConsume:   preConsumedQuota,
	}

	if common.DebugEnabled {
		println(fmt.Sprintf("model_price_helper result: %s", priceData.ToSetting()))
	}
	info.PriceData = priceData
	return priceData, nil
}

func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
	groupDiscountInfo := HandleGroupRatio(c, info)
	modelName := pricing.FormatMatchingModelName(info.OriginModelName)

	modelPricing, found := pricing.GetModelPricing(info.OriginModelName)
	if !found {
		return types.PriceData{}, fmt.Errorf("model pricing not found: %s", info.OriginModelName)
	}

	applyUserOverride(info, modelName, &modelPricing, &groupDiscountInfo)

	if !modelPricing.UsePerCallPricing {
		modelPricing.PerCallPrice = modelPricing.PromptPrice
	}

	quota := int(modelPricing.PerCallPrice * float64(common.MicrodollarsPerUnit) * groupDiscountInfo.GroupDiscount)

	freeModel := false
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupDiscountInfo.GroupDiscount == 0 || modelPricing.PerCallPrice == 0 {
			quota = 0
			freeModel = true
		}
	}

	priceData := types.PriceData{
		FreeModel:          freeModel,
		PerCallPrice:       modelPricing.PerCallPrice,
		UsePerCallPricing:  true,
		GroupDiscountInfo:  groupDiscountInfo,
		Quota:             quota,
	}
	return priceData, nil
}

func ContainPriceOrRatio(modelName string) bool {
	return pricing.IsModelConfigured(modelName)
}

func HandleProviderRatio(info *relaycommon.RelayInfo) types.ProviderRatioInfo {
	return types.ProviderRatioInfo{
		ProviderRatio: 1.0,
	}
}