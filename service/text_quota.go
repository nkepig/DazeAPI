package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/pricing"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type textQuotaSummary struct {
	PromptTokens             int
	CompletionTokens         int
	TotalTokens              int
	CacheTokens              int
	CacheCreationTokens      int
	CacheCreationTokens5m    int
	CacheCreationTokens1h    int
	ImageTokens              int
	AudioTokens              int
	ModelName                string
	TokenName                string
	UseTimeSeconds           int64
	PromptPrice              float64
	CompletionPrice          float64
	CacheReadPrice           float64
	CacheWritePrice          float64
	CacheWrite5mPrice        float64
	CacheWrite1hPrice        float64
	ImagePrice               float64
	AudioInputPrice          float64
	GroupDiscount            float64
	PerCallPrice             float64
	UsePerCallPricing        bool
	QuotaMicrodollars        int64
	IsClaudeUsageSemantic    bool
	UsageSemantic            string
	WebSearchPrice           float64
	WebSearchCallCount       int
	ClaudeWebSearchPrice     float64
	ClaudeWebSearchCallCount int
	FileSearchPrice          float64
	FileSearchCallCount      int
	ImageGenerationCallPrice float64
}

func cacheWriteTokensTotal(summary textQuotaSummary) int {
	if summary.CacheCreationTokens5m > 0 || summary.CacheCreationTokens1h > 0 {
		splitCacheWriteTokens := summary.CacheCreationTokens5m + summary.CacheCreationTokens1h
		if summary.CacheCreationTokens > splitCacheWriteTokens {
			return summary.CacheCreationTokens
		}
		return splitCacheWriteTokens
	}
	return summary.CacheCreationTokens
}

func isLegacyClaudeDerivedOpenAIUsage(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) bool {
	if relayInfo == nil || usage == nil {
		return false
	}
	if relayInfo.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		return false
	}
	if usage.UsageSource != "" || usage.UsageSemantic != "" {
		return false
	}
	return usage.ClaudeCacheCreation5mTokens > 0 || usage.ClaudeCacheCreation1hTokens > 0
}

func calculateTextQuotaSummary(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage) textQuotaSummary {
	priceData := relayInfo.PriceData
	summary := textQuotaSummary{
		ModelName:         relayInfo.OriginModelName,
		TokenName:         ctx.GetString("token_name"),
		UseTimeSeconds:    time.Now().Unix() - relayInfo.StartTime.Unix(),
		PromptPrice:       priceData.PromptPrice,
		CompletionPrice:   priceData.CompletionPrice,
		CacheReadPrice:    priceData.CacheReadPrice,
		CacheWritePrice:   priceData.CacheWritePrice,
		CacheWrite5mPrice: priceData.CacheWrite5mPrice,
		CacheWrite1hPrice: priceData.CacheWrite1hPrice,
		ImagePrice:        priceData.ImagePrice,
		AudioInputPrice:   priceData.AudioInputPrice,
		GroupDiscount:     priceData.GroupDiscountInfo.GroupDiscount,
		PerCallPrice:      priceData.PerCallPrice,
		UsePerCallPricing: priceData.UsePerCallPricing,
		UsageSemantic:     usageSemanticFromUsage(relayInfo, usage),
	}
	summary.IsClaudeUsageSemantic = summary.UsageSemantic == "anthropic"

	if usage == nil {
		usage = &dto.Usage{
			PromptTokens:     relayInfo.GetEstimatePromptTokens(),
			CompletionTokens: 0,
			TotalTokens:      relayInfo.GetEstimatePromptTokens(),
		}
	}

	summary.PromptTokens = usage.PromptTokens
	summary.CompletionTokens = usage.CompletionTokens
	summary.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	summary.CacheTokens = usage.PromptTokensDetails.CachedTokens
	summary.CacheCreationTokens = usage.PromptTokensDetails.CachedCreationTokens
	summary.CacheCreationTokens5m = usage.ClaudeCacheCreation5mTokens
	summary.CacheCreationTokens1h = usage.ClaudeCacheCreation1hTokens
	summary.ImageTokens = usage.PromptTokensDetails.ImageTokens
	summary.AudioTokens = usage.PromptTokensDetails.AudioTokens
	legacyClaudeDerived := isLegacyClaudeDerivedOpenAIUsage(relayInfo, usage)
	isOpenRouterClaudeBilling := relayInfo.ChannelMeta != nil &&
		relayInfo.ChannelType == constant.ChannelTypeOpenRouter &&
		summary.IsClaudeUsageSemantic

	if isOpenRouterClaudeBilling {
		summary.PromptTokens -= summary.CacheTokens
		isUsingCustomSettings := priceData.UsePerCallPricing
		if summary.CacheCreationTokens == 0 && priceData.CacheWritePrice != 0 && usage.Cost != 0 && !isUsingCustomSettings {
			maybeCacheCreationTokens := CalcOpenRouterCacheCreateTokens(*usage, priceData)
			if maybeCacheCreationTokens >= 0 && summary.PromptTokens >= maybeCacheCreationTokens {
				summary.CacheCreationTokens = maybeCacheCreationTokens
			}
		}
		summary.PromptTokens -= summary.CacheCreationTokens
	}

	microdollarsPerMillion := decimal.NewFromInt(pricing.MicrodollarsPerDollar)
	groupDiscount := decimal.NewFromFloat(summary.GroupDiscount)

	var dWebSearchQuota decimal.Decimal
	if relayInfo.ResponsesUsageInfo != nil {
		if webSearchTool, exists := relayInfo.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview]; exists && webSearchTool.CallCount > 0 {
			summary.WebSearchCallCount = webSearchTool.CallCount
			summary.WebSearchPrice = operation_setting.GetWebSearchPricePerThousand(summary.ModelName, webSearchTool.SearchContextSize)
			dWebSearchQuota = decimal.NewFromFloat(summary.WebSearchPrice).
				Mul(decimal.NewFromInt(int64(webSearchTool.CallCount))).
				Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount)
		}
	} else if strings.HasSuffix(summary.ModelName, "search-preview") {
		searchContextSize := ctx.GetString("chat_completion_web_search_context_size")
		if searchContextSize == "" {
			searchContextSize = "medium"
		}
		summary.WebSearchCallCount = 1
		summary.WebSearchPrice = operation_setting.GetWebSearchPricePerThousand(summary.ModelName, searchContextSize)
		dWebSearchQuota = decimal.NewFromFloat(summary.WebSearchPrice).
			Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount)
	}

	var dClaudeWebSearchQuota decimal.Decimal
	summary.ClaudeWebSearchCallCount = ctx.GetInt("claude_web_search_requests")
	if summary.ClaudeWebSearchCallCount > 0 {
		summary.ClaudeWebSearchPrice = operation_setting.GetClaudeWebSearchPricePerThousand()
		dClaudeWebSearchQuota = decimal.NewFromFloat(summary.ClaudeWebSearchPrice).
			Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount).
			Mul(decimal.NewFromInt(int64(summary.ClaudeWebSearchCallCount)))
	}

	var dFileSearchQuota decimal.Decimal
	if relayInfo.ResponsesUsageInfo != nil {
		if fileSearchTool, exists := relayInfo.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolFileSearch]; exists && fileSearchTool.CallCount > 0 {
			summary.FileSearchCallCount = fileSearchTool.CallCount
			summary.FileSearchPrice = operation_setting.GetFileSearchPricePerThousand()
			dFileSearchQuota = decimal.NewFromFloat(summary.FileSearchPrice).
				Mul(decimal.NewFromInt(int64(fileSearchTool.CallCount))).
				Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount)
		}
	}

	var dImageGenerationCallQuota decimal.Decimal
	if ctx.GetBool("image_generation_call") {
		summary.ImageGenerationCallPrice = operation_setting.GetGPTImage1PriceOnceCall(ctx.GetString("image_generation_call_quality"), ctx.GetString("image_generation_call_size"))
		dImageGenerationCallQuota = decimal.NewFromFloat(summary.ImageGenerationCallPrice).Mul(microdollarsPerMillion).Mul(groupDiscount)
	}

	if !summary.UsePerCallPricing {
		dPromptTokens := decimal.NewFromInt(int64(summary.PromptTokens))
		dCacheTokens := decimal.NewFromInt(int64(summary.CacheTokens))
		dImageTokens := decimal.NewFromInt(int64(summary.ImageTokens))
		dAudioTokens := decimal.NewFromInt(int64(summary.AudioTokens))
		dCompletionTokens := decimal.NewFromInt(int64(summary.CompletionTokens))
		dCachedCreationTokens := decimal.NewFromInt(int64(summary.CacheCreationTokens))

		dPromptPrice := decimal.NewFromFloat(summary.PromptPrice)
		dCompletionPrice := decimal.NewFromFloat(summary.CompletionPrice)
		dCacheReadPrice := decimal.NewFromFloat(summary.CacheReadPrice)
		dCacheWritePrice := decimal.NewFromFloat(summary.CacheWritePrice)
		dCacheWrite5mPrice := decimal.NewFromFloat(summary.CacheWrite5mPrice)
		dCacheWrite1hPrice := decimal.NewFromFloat(summary.CacheWrite1hPrice)
		dImagePrice := decimal.NewFromFloat(summary.ImagePrice)
		dAudioInputPrice := decimal.NewFromFloat(summary.AudioInputPrice)

		baseTokens := dPromptTokens
		var cachedTokensCost decimal.Decimal
		if !dCacheTokens.IsZero() {
			if !summary.IsClaudeUsageSemantic && !legacyClaudeDerived {
				baseTokens = baseTokens.Sub(dCacheTokens)
			}
			// 缓存读的实际成本 = cacheTokens × cacheReadPrice
			cachedTokensCost = dCacheTokens.Mul(dCacheReadPrice)
		}

		var cacheWriteCost decimal.Decimal
		hasSplitCacheCreationTokens := summary.CacheCreationTokens5m > 0 || summary.CacheCreationTokens1h > 0
		if !dCachedCreationTokens.IsZero() || hasSplitCacheCreationTokens {
			if !summary.IsClaudeUsageSemantic && !legacyClaudeDerived {
				baseTokens = baseTokens.Sub(dCachedCreationTokens)
				cacheWriteCost = dCachedCreationTokens.Mul(dCacheWritePrice)
			} else {
				remaining := summary.CacheCreationTokens - summary.CacheCreationTokens5m - summary.CacheCreationTokens1h
				if remaining < 0 {
					remaining = 0
				}
				cacheWriteCost = decimal.NewFromInt(int64(remaining)).Mul(dCacheWritePrice)
				cacheWriteCost = cacheWriteCost.Add(decimal.NewFromInt(int64(summary.CacheCreationTokens5m)).Mul(dCacheWrite5mPrice))
				cacheWriteCost = cacheWriteCost.Add(decimal.NewFromInt(int64(summary.CacheCreationTokens1h)).Mul(dCacheWrite1hPrice))
			}
		}

		var imageCost decimal.Decimal
		if !dImageTokens.IsZero() {
			baseTokens = baseTokens.Sub(dImageTokens)
			imageCost = dImageTokens.Mul(dImagePrice)
		}

		var audioInputCost decimal.Decimal
		if !dAudioTokens.IsZero() && summary.AudioInputPrice > 0 {
			baseTokens = baseTokens.Sub(dAudioTokens)
			audioInputCost = dAudioTokens.Mul(dAudioInputPrice).Div(decimal.NewFromInt(1000000))
		}

		promptCost := baseTokens.Mul(dPromptPrice)
		completionCost := dCompletionTokens.Mul(dCompletionPrice)
		totalCost := promptCost.Add(completionCost).Add(cachedTokensCost).Add(cacheWriteCost).Add(imageCost).Add(audioInputCost)
		totalCost = totalCost.Mul(groupDiscount)

		totalCost = totalCost.Add(dWebSearchQuota)
		totalCost = totalCost.Add(dClaudeWebSearchQuota)
		totalCost = totalCost.Add(dFileSearchQuota)
		totalCost = totalCost.Add(dImageGenerationCallQuota)

		if len(priceData.OtherDiscounts) > 0 {
			for _, discount := range priceData.OtherDiscounts {
				totalCost = totalCost.Mul(decimal.NewFromFloat(discount))
			}
		}

		summary.QuotaMicrodollars = totalCost.Round(0).IntPart()
	} else {
		totalCost := decimal.NewFromFloat(summary.PerCallPrice).Mul(microdollarsPerMillion).Mul(groupDiscount)
		totalCost = totalCost.Add(dWebSearchQuota)
		totalCost = totalCost.Add(dClaudeWebSearchQuota)
		totalCost = totalCost.Add(dFileSearchQuota)
		totalCost = totalCost.Add(dImageGenerationCallQuota)
		if len(priceData.OtherDiscounts) > 0 {
			for _, discount := range priceData.OtherDiscounts {
				totalCost = totalCost.Mul(decimal.NewFromFloat(discount))
			}
		}
		summary.QuotaMicrodollars = totalCost.Round(0).IntPart()
	}

	if summary.TotalTokens == 0 {
		summary.QuotaMicrodollars = 0
	}

	return summary
}

func usageSemanticFromUsage(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) string {
	if usage != nil && usage.UsageSemantic != "" {
		return usage.UsageSemantic
	}
	if relayInfo != nil && relayInfo.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		return "anthropic"
	}
	return "openai"
}

func PostTextConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent []string) {
	originUsage := usage
	if usage == nil {
		extraContent = append(extraContent, "上游无计费信息")
	}
	if originUsage != nil {
		ObserveChannelAffinityUsageCacheByRelayFormat(ctx, usage, relayInfo.GetFinalRequestRelayFormat())
	}

	adminRejectReason := common.GetContextKeyString(ctx, constant.ContextKeyAdminRejectReason)
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	microdollarsPerMillion := decimal.NewFromInt(pricing.MicrodollarsPerDollar)
	groupDiscount := decimal.NewFromFloat(summary.GroupDiscount)

	if summary.WebSearchCallCount > 0 {
		cost := decimal.NewFromFloat(summary.WebSearchPrice).Mul(decimal.NewFromInt(int64(summary.WebSearchCallCount))).Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount)
		extraContent = append(extraContent, fmt.Sprintf("Web Search 调用 %d 次，调用花费 %s", summary.WebSearchCallCount, pricing.FormatDollars(cost.IntPart())))
	}
	if summary.ClaudeWebSearchCallCount > 0 {
		cost := decimal.NewFromFloat(summary.ClaudeWebSearchPrice).Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount).Mul(decimal.NewFromInt(int64(summary.ClaudeWebSearchCallCount)))
		extraContent = append(extraContent, fmt.Sprintf("Claude Web Search 调用 %d 次，调用花费 %s", summary.ClaudeWebSearchCallCount, pricing.FormatDollars(cost.IntPart())))
	}
	if summary.FileSearchCallCount > 0 {
		cost := decimal.NewFromFloat(summary.FileSearchPrice).Mul(decimal.NewFromInt(int64(summary.FileSearchCallCount))).Mul(microdollarsPerMillion).Div(decimal.NewFromInt(1000)).Mul(groupDiscount)
		extraContent = append(extraContent, fmt.Sprintf("File Search 调用 %d 次，调用花费 %s", summary.FileSearchCallCount, pricing.FormatDollars(cost.IntPart())))
	}
	if summary.AudioInputPrice > 0 && summary.AudioTokens > 0 {
		cost := decimal.NewFromFloat(summary.AudioInputPrice).Mul(decimal.NewFromInt(int64(summary.AudioTokens))).Mul(groupDiscount)
		extraContent = append(extraContent, fmt.Sprintf("Audio Input 花费 %s", pricing.FormatDollars(cost.IntPart())))
	}
	if summary.ImageGenerationCallPrice > 0 {
		cost := decimal.NewFromFloat(summary.ImageGenerationCallPrice).Mul(microdollarsPerMillion).Mul(groupDiscount)
		extraContent = append(extraContent, fmt.Sprintf("Image Generation Call 花费 %s", pricing.FormatDollars(cost.IntPart())))
	}

	if summary.TotalTokens == 0 {
		extraContent = append(extraContent, "上游没有返回计费信息，无法扣费（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, summary.ModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, int(summary.QuotaMicrodollars))
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, int(summary.QuotaMicrodollars))
	}

	if err := SettleBilling(ctx, relayInfo, int(summary.QuotaMicrodollars)); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := summary.ModelName
	if strings.HasPrefix(logModel, "gpt-4-gizmo") {
		logModel = "gpt-4-gizmo-*"
		extraContent = append(extraContent, fmt.Sprintf("模型 %s", summary.ModelName))
	}
	if strings.HasPrefix(logModel, "gpt-4o-gizmo") {
		logModel = "gpt-4o-gizmo-*"
		extraContent = append(extraContent, fmt.Sprintf("模型 %s", summary.ModelName))
	}

	logContent := strings.Join(extraContent, ", ")
	var other map[string]interface{}
	if summary.IsClaudeUsageSemantic {
		other = GenerateClaudeOtherInfo(ctx, relayInfo,
			summary.PromptPrice, summary.GroupDiscount, summary.CompletionPrice,
			summary.CacheTokens, summary.CacheReadPrice,
			summary.CacheCreationTokens, summary.CacheWritePrice,
			summary.CacheCreationTokens5m, summary.CacheWrite5mPrice,
			summary.CacheCreationTokens1h, summary.CacheWrite1hPrice,
			summary.PerCallPrice, relayInfo.PriceData.GroupDiscountInfo.GroupSpecialRatio)
		other["usage_semantic"] = "anthropic"
	} else {
		other = GenerateTextOtherInfo(ctx, relayInfo, summary.PromptPrice, summary.GroupDiscount, summary.CompletionPrice, summary.CacheTokens, summary.CacheReadPrice, summary.PerCallPrice, relayInfo.PriceData.GroupDiscountInfo.GroupSpecialRatio)
	}
	if adminRejectReason != "" {
		other["reject_reason"] = adminRejectReason
	}
	if summary.ImageTokens != 0 {
		other["image"] = true
		other["image_price"] = summary.ImagePrice
		other["image_output"] = summary.ImageTokens
	}
	if summary.WebSearchCallCount > 0 {
		other["web_search"] = true
		other["web_search_call_count"] = summary.WebSearchCallCount
		other["web_search_price"] = summary.WebSearchPrice
	} else if summary.ClaudeWebSearchCallCount > 0 {
		other["web_search"] = true
		other["web_search_call_count"] = summary.ClaudeWebSearchCallCount
		other["web_search_price"] = summary.ClaudeWebSearchPrice
	}
	if summary.FileSearchCallCount > 0 {
		other["file_search"] = true
		other["file_search_call_count"] = summary.FileSearchCallCount
		other["file_search_price"] = summary.FileSearchPrice
	}
	if summary.AudioInputPrice > 0 && summary.AudioTokens > 0 {
		other["audio_input_seperate_price"] = true
		other["audio_input_token_count"] = summary.AudioTokens
		other["audio_input_price"] = summary.AudioInputPrice
	}
	if summary.ImageGenerationCallPrice > 0 {
		other["image_generation_call"] = true
		other["image_generation_call_price"] = summary.ImageGenerationCallPrice
	}
	if summary.CacheCreationTokens > 0 {
		other["cache_creation_tokens"] = summary.CacheCreationTokens
		other["cache_write_price"] = summary.CacheWritePrice
	}
	if summary.CacheCreationTokens5m > 0 {
		other["cache_creation_tokens_5m"] = summary.CacheCreationTokens5m
		other["cache_write_5m_price"] = summary.CacheWrite5mPrice
	}
	if summary.CacheCreationTokens1h > 0 {
		other["cache_creation_tokens_1h"] = summary.CacheCreationTokens1h
		other["cache_write_1h_price"] = summary.CacheWrite1hPrice
	}
	cacheWriteTokens := cacheWriteTokensTotal(summary)
	if cacheWriteTokens > 0 {
		other["cache_write_tokens"] = cacheWriteTokens
	}
	if relayInfo.GetFinalRequestRelayFormat() != types.RelayFormatClaude && usage != nil && usage.UsageSource != "" && usage.InputTokens > 0 {
		other["input_tokens_total"] = usage.InputTokens
	}

	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     summary.PromptTokens,
		CompletionTokens: summary.CompletionTokens,
		ModelName:        logModel,
		TokenName:        summary.TokenName,
		Quota:            int(summary.QuotaMicrodollars),
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(summary.UseTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}
