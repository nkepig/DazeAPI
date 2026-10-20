package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/pricing"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

var usageGatewayOnlyKeys = map[string]struct{}{
	"usage_semantic": {},
	"usage_source":   {},
}

const usageValueMaxLen = 200

// AttachUsageDict stores the upstream usage object as other["usage"].
// Prefer the original JSON from the model response so extra keys, zeros, and
// nulls are preserved. Fall back to a full struct marshal when usage was built in code.
func AttachUsageDict(other map[string]interface{}, usage any) {
	if other == nil || usage == nil {
		return
	}
	asMap := usageDictFromValue(usage)
	if len(asMap) == 0 {
		return
	}
	other["usage"] = SanitizeUsageDict(asMap)
}

// SanitizeUsageDict unwraps a full model response mistakenly stored as usage,
// then clips oversized extra fields so the log UI can render them.
func SanitizeUsageDict(asMap map[string]interface{}) map[string]interface{} {
	if asMap == nil {
		return nil
	}
	asMap = unwrapUsageDict(asMap)
	clipped, _ := clipUsageValue(asMap, true).(map[string]interface{})
	if clipped == nil {
		return asMap
	}
	return clipped
}

func unwrapUsageDict(asMap map[string]interface{}) map[string]interface{} {
	if asMap == nil {
		return nil
	}
	if metadata, ok := asMap["usageMetadata"].(map[string]interface{}); ok && metadata != nil && looksLikeGeminiUsageMap(metadata) && !looksLikeGeminiUsageMap(asMap) {
		return metadata
	}
	nested, ok := asMap["usage"].(map[string]interface{})
	if !ok || nested == nil {
		return asMap
	}
	if looksLikeUsageMap(asMap) {
		return asMap
	}
	if looksLikeUsageMap(nested) {
		return nested
	}
	return asMap
}

func looksLikeGeminiUsageMap(asMap map[string]interface{}) bool {
	if asMap == nil {
		return false
	}
	for _, key := range []string{"promptTokenCount", "candidatesTokenCount", "totalTokenCount", "candidatesTokensDetails"} {
		if _, ok := asMap[key]; ok {
			return true
		}
	}
	return false
}

func looksLikeUsageMap(asMap map[string]interface{}) bool {
	if asMap == nil {
		return false
	}
	for _, key := range []string{"prompt_tokens", "completion_tokens", "input_tokens", "output_tokens", "total_tokens"} {
		if _, ok := asMap[key]; ok {
			return true
		}
	}
	return false
}

func clipUsageValue(value any, isRoot bool) any {
	switch typed := value.(type) {
	case string:
		return clipUsageString(typed)
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			out[key] = clipUsageValue(child, false)
		}
		if isRoot {
			return out
		}
		raw, err := common.Marshal(out)
		if err != nil || len(raw) <= usageValueMaxLen {
			return out
		}
		return clipUsageString(string(raw))
	case []interface{}:
		raw, err := common.Marshal(typed)
		if err != nil {
			return typed
		}
		if len(raw) > usageValueMaxLen {
			return clipUsageString(string(raw))
		}
		clipped := make([]interface{}, len(typed))
		for i, child := range typed {
			clipped[i] = clipUsageValue(child, false)
		}
		return clipped
	default:
		return value
	}
}

func clipUsageString(s string) string {
	runes := []rune(s)
	if len(runes) <= usageValueMaxLen {
		return s
	}
	return string(runes[:usageValueMaxLen]) + "…"
}

func usageDictFromValue(usage any) map[string]interface{} {
	switch typed := usage.(type) {
	case *dto.Usage:
		if typed == nil {
			return nil
		}
		return usageDictFromUsage(typed)
	case dto.Usage:
		return usageDictFromUsage(&typed)
	default:
		return marshalUsageMap(usage)
	}
}

func usageDictFromUsage(usage *dto.Usage) map[string]interface{} {
	if usage == nil {
		return nil
	}
	if len(usage.OriginalUsageJSON) > 0 && string(usage.OriginalUsageJSON) != "null" {
		var asMap map[string]interface{}
		if err := common.Unmarshal(usage.OriginalUsageJSON, &asMap); err == nil && asMap != nil {
			return asMap
		}
	}
	return marshalUsageMap(usage)
}

func marshalUsageMap(usage any) map[string]interface{} {
	raw, err := common.Marshal(usage)
	if err != nil || len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var asMap map[string]interface{}
	if err := common.Unmarshal(raw, &asMap); err != nil || asMap == nil {
		return nil
	}
	for key := range usageGatewayOnlyKeys {
		delete(asMap, key)
	}
	return asMap
}

func appendRequestPath(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if other == nil {
		return
	}
	if ctx != nil && ctx.Request != nil && ctx.Request.URL != nil {
		if path := ctx.Request.URL.Path; path != "" {
			other["request_path"] = path
			return
		}
	}
	if relayInfo != nil && relayInfo.RequestURLPath != "" {
		path := relayInfo.RequestURLPath
		if idx := strings.Index(path, "?"); idx != -1 {
			path = path[:idx]
		}
		other["request_path"] = path
	}
}

func GenerateTextOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, promptPrice, groupDiscount, completionPrice float64,
	cacheTokens int, cacheReadPrice, perCallPrice, userGroupDiscount float64) map[string]interface{} {
	other := make(map[string]interface{})
	other["prompt_price"] = promptPrice
	other["group_discount"] = groupDiscount
	other["completion_price"] = completionPrice
	other["cache_tokens"] = cacheTokens
	other["cache_read_price"] = cacheReadPrice
	other["per_call_price"] = perCallPrice
	other["user_group_discount"] = userGroupDiscount
	other["frt"] = float64(relayInfo.FirstResponseTime.UnixMilli() - relayInfo.StartTime.UnixMilli())
	if relayInfo.PriceData.UseTieredPricing {
		other["billing_mode"] = pricing.BillingModeTiered
		if relayInfo.PriceData.MatchedTier != "" {
			other["matched_tier"] = relayInfo.PriceData.MatchedTier
		}
	}
	if relayInfo.ReasoningEffort != "" {
		other["reasoning_effort"] = relayInfo.ReasoningEffort
	}
	if relayInfo.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = relayInfo.UpstreamModelName
	}

	isSystemPromptOverwritten := common.GetContextKeyBool(ctx, constant.ContextKeySystemPromptOverride)
	if isSystemPromptOverwritten {
		other["is_system_prompt_overwritten"] = true
	}

	other["admin_info"] = BuildLogAdminInfo(ctx)
	appendRequestPath(ctx, relayInfo, other)
	appendRequestConversionChain(relayInfo, other)
	appendFinalRequestFormat(relayInfo, other)
	appendBillingInfo(relayInfo, other)
	appendParamOverrideInfo(relayInfo, other)
	return other
}

func appendParamOverrideInfo(relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if relayInfo == nil || other == nil || len(relayInfo.ParamOverrideAudit) == 0 {
		return
	}
	other["po"] = relayInfo.ParamOverrideAudit
}

func appendBillingInfo(relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if relayInfo == nil || other == nil {
		return
	}
	if relayInfo.BillingSource != "" {
		other["billing_source"] = relayInfo.BillingSource
	}
	if relayInfo.UserSetting.BillingPreference != "" {
		other["billing_preference"] = relayInfo.UserSetting.BillingPreference
	}
	if relayInfo.BillingSource == "subscription" {
		if relayInfo.SubscriptionId != 0 {
			other["subscription_id"] = relayInfo.SubscriptionId
		}
		if relayInfo.SubscriptionPreConsumed > 0 {
			other["subscription_pre_consumed"] = relayInfo.SubscriptionPreConsumed
		}
		if relayInfo.SubscriptionPostDelta != 0 {
			other["subscription_post_delta"] = relayInfo.SubscriptionPostDelta
		}
		if relayInfo.SubscriptionPlanId != 0 {
			other["subscription_plan_id"] = relayInfo.SubscriptionPlanId
		}
		if relayInfo.SubscriptionPlanTitle != "" {
			other["subscription_plan_title"] = relayInfo.SubscriptionPlanTitle
		}
		consumed := relayInfo.SubscriptionPreConsumed + relayInfo.SubscriptionPostDelta
		usedFinal := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		if consumed < 0 {
			consumed = 0
		}
		if usedFinal < 0 {
			usedFinal = 0
		}
		if relayInfo.SubscriptionAmountTotal > 0 {
			remain := relayInfo.SubscriptionAmountTotal - usedFinal
			if remain < 0 {
				remain = 0
			}
			other["subscription_total"] = relayInfo.SubscriptionAmountTotal
			other["subscription_used"] = usedFinal
			other["subscription_remain"] = remain
		}
		if consumed > 0 {
			other["subscription_consumed"] = consumed
		}
		other["wallet_quota_deducted"] = 0
	}
}

func appendRequestConversionChain(relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if relayInfo == nil || other == nil {
		return
	}
	if len(relayInfo.RequestConversionChain) == 0 {
		return
	}
	chain := make([]string, 0, len(relayInfo.RequestConversionChain))
	for _, f := range relayInfo.RequestConversionChain {
		switch f {
		case types.RelayFormatOpenAI:
			chain = append(chain, "OpenAI Compatible")
		case types.RelayFormatClaude:
			chain = append(chain, "Claude Messages")
		case types.RelayFormatGemini:
			chain = append(chain, "Google Gemini")
		case types.RelayFormatOpenAIResponses:
			chain = append(chain, "OpenAI Responses")
		default:
			chain = append(chain, string(f))
		}
	}
	if len(chain) == 0 {
		return
	}
	other["request_conversion"] = chain
}

func appendFinalRequestFormat(relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if relayInfo == nil || other == nil {
		return
	}
	if relayInfo.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		other["claude"] = true
	}
}

func GenerateWssOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage, priceData types.PriceData) map[string]interface{} {
	info := GenerateTextOtherInfo(ctx, relayInfo, priceData.PromptPrice, priceData.GroupDiscountInfo.GroupDiscount, priceData.CompletionPrice, 0, priceData.CacheReadPrice, priceData.PerCallPrice, priceData.GroupDiscountInfo.GroupSpecialRatio)
	info["ws"] = true
	info["audio_input"] = usage.InputTokenDetails.AudioTokens
	info["audio_output"] = usage.OutputTokenDetails.AudioTokens
	info["text_input"] = usage.InputTokenDetails.TextTokens
	info["text_output"] = usage.OutputTokenDetails.TextTokens
	info["audio_input_price"] = priceData.AudioInputPrice
	info["audio_output_price"] = priceData.AudioOutputPrice
	AttachUsageDict(info, usage)
	return info
}

func GenerateAudioOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, priceData types.PriceData) map[string]interface{} {
	info := GenerateTextOtherInfo(ctx, relayInfo, priceData.PromptPrice, priceData.GroupDiscountInfo.GroupDiscount, priceData.CompletionPrice, 0, priceData.CacheReadPrice, priceData.PerCallPrice, priceData.GroupDiscountInfo.GroupSpecialRatio)
	info["audio"] = true
	info["audio_input"] = usage.PromptTokensDetails.AudioTokens
	info["audio_output"] = usage.CompletionTokenDetails.AudioTokens
	info["text_input"] = usage.PromptTokensDetails.TextTokens
	info["text_output"] = usage.CompletionTokenDetails.TextTokens
	info["audio_input_price"] = priceData.AudioInputPrice
	info["audio_output_price"] = priceData.AudioOutputPrice
	AttachUsageDict(info, usage)
	return info
}

func GenerateClaudeOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, promptPrice, groupDiscount, completionPrice float64,
	cacheTokens int, cacheReadPrice float64,
	cacheCreationTokens int, cacheWritePrice float64,
	cacheCreationTokens5m int, cacheWrite5mPrice float64,
	cacheCreationTokens1h int, cacheWrite1hPrice float64,
	perCallPrice, userGroupDiscount float64) map[string]interface{} {
	info := GenerateTextOtherInfo(ctx, relayInfo, promptPrice, groupDiscount, completionPrice, cacheTokens, cacheReadPrice, perCallPrice, userGroupDiscount)
	info["claude"] = true
	info["cache_creation_tokens"] = cacheCreationTokens
	info["cache_write_price"] = cacheWritePrice
	if cacheCreationTokens5m != 0 {
		info["cache_creation_tokens_5m"] = cacheCreationTokens5m
		info["cache_write_5m_price"] = cacheWrite5mPrice
	}
	if cacheCreationTokens1h != 0 {
		info["cache_creation_tokens_1h"] = cacheCreationTokens1h
		info["cache_write_1h_price"] = cacheWrite1hPrice
	}
	return info
}
