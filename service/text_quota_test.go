package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCalculateTextQuotaSummaryUnifiedForClaudeSemantic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
	}

	priceData := types.PriceData{
		PromptPrice:       1,
		CompletionPrice:   2,
		CacheReadPrice:    0.1,
		CacheWritePrice:   1.25,
		CacheWrite5mPrice: 1.25,
		CacheWrite1hPrice: 2,
		GroupDiscountInfo: types.GroupDiscountInfo{
			GroupDiscount: 1,
		},
	}

	chatRelayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}
	messageRelayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatClaude,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData:               priceData,
		StartTime:               time.Now(),
	}

	chatSummary := calculateTextQuotaSummary(ctx, chatRelayInfo, usage)
	messageSummary := calculateTextQuotaSummary(ctx, messageRelayInfo, usage)

	require.Equal(t, messageSummary.QuotaMicrodollars, chatSummary.QuotaMicrodollars)
	require.Equal(t, messageSummary.CacheCreationTokens5m, chatSummary.CacheCreationTokens5m)
	require.Equal(t, messageSummary.CacheCreationTokens1h, chatSummary.CacheCreationTokens1h)
	require.True(t, chatSummary.IsClaudeUsageSemantic)
	require.Equal(t, int64(1488), chatSummary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryUsesSplitClaudeCacheCreationRatios(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "claude-3-7-sonnet",
		PriceData: types.PriceData{
			PromptPrice:       1,
			CompletionPrice:   1,
			CacheReadPrice:    0,
			CacheWritePrice:   1,
			CacheWrite5mPrice: 2,
			CacheWrite1hPrice: 3,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 0,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 10,
		},
		ClaudeCacheCreation5mTokens: 2,
		ClaudeCacheCreation1hTokens: 3,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// 100 + remaining(5)*1 + 2*2 + 3*3 = 118
	require.Equal(t, int64(118), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryUsesAnthropicUsageSemanticFromUpstreamUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			PromptPrice:       1,
			CompletionPrice:   2,
			CacheReadPrice:    0.1,
			CacheWritePrice:   1.25,
			CacheWrite5mPrice: 1.25,
			CacheWrite1hPrice: 2,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		UsageSemantic:    "anthropic",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, "anthropic", summary.UsageSemantic)
	require.Equal(t, int64(1488), summary.QuotaMicrodollars)
}

func TestCacheWriteTokensTotal(t *testing.T) {
	t.Run("split cache creation", func(t *testing.T) {
		summary := textQuotaSummary{
			CacheCreationTokens:   50,
			CacheCreationTokens5m: 10,
			CacheCreationTokens1h: 20,
		}
		require.Equal(t, 50, cacheWriteTokensTotal(summary))
	})

	t.Run("legacy cache creation", func(t *testing.T) {
		summary := textQuotaSummary{CacheCreationTokens: 50}
		require.Equal(t, 50, cacheWriteTokensTotal(summary))
	})

	t.Run("split cache creation without aggregate remainder", func(t *testing.T) {
		summary := textQuotaSummary{
			CacheCreationTokens5m: 10,
			CacheCreationTokens1h: 20,
		}
		require.Equal(t, 30, cacheWriteTokensTotal(summary))
	})
}

func TestCalculateTextQuotaSummaryHandlesLegacyClaudeDerivedOpenAIUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "claude-3-7-sonnet",
		PriceData: types.PriceData{
			PromptPrice:       1,
			CompletionPrice:   5,
			CacheReadPrice:    0.1,
			CacheWritePrice:   1.25,
			CacheWrite5mPrice: 1.25,
			CacheWrite1hPrice: 2,
			GroupDiscountInfo: types.GroupDiscountInfo{GroupDiscount: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     62,
		CompletionTokens: 95,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 3544,
		},
		ClaudeCacheCreation5mTokens: 586,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	require.Equal(t, int64(1624), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummarySeparatesOpenRouterCacheCreationFromPromptBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "openai/gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			PromptPrice:       1,
			CompletionPrice:   1,
			CacheWritePrice:   1.25,
			GroupDiscountInfo: types.GroupDiscountInfo{GroupDiscount: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 100,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// prompt_tokens is still logged as total input, but cache creation is billed separately.
	// quota = (2604 - 100) + 100*1.25 + 383 = 3012
	require.Equal(t, 2604, summary.PromptTokens)
	require.Equal(t, int64(3012), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryKeepsPrePRClaudeOpenRouterBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "anthropic/claude-3.7-sonnet",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			PromptPrice:       1,
			CompletionPrice:   1,
			CacheReadPrice:    0.1,
			CacheWritePrice:   1.25,
			GroupDiscountInfo: types.GroupDiscountInfo{GroupDiscount: 1},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     2604,
		CompletionTokens: 383,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 2432,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	// Pre-PR PostClaudeConsumeQuota behavior for OpenRouter:
	// prompt = 2604 - 2432 = 172
	// quota = 172 + 2432*0.1 + 383 = 798.2 => 798
	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, 172, summary.PromptTokens)
	require.Equal(t, int64(798), summary.QuotaMicrodollars)
}

func TestTinyOpenRouterTextQuotaDoesNotFallToOne(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "test-model",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			PromptPrice:     0.000001,
			CompletionPrice: 0.000001,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     1,
		CompletionTokens: 1,
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, int64(0), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryOpenRouterKimiBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "moonshotai/kimi-k2.5",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenRouter,
		},
		PriceData: types.PriceData{
			PromptPrice:     0.6,
			CompletionPrice: 3,
			CacheReadPrice:  0.1,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     167846,
		CompletionTokens: 468,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 167680,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, int64(18272), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryOpenAIResponsesCacheWriteTokens(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAIResponses,
		OriginModelName: "gpt-5.6-sol",
		PriceData: types.PriceData{
			PromptPrice:     5,
			CompletionPrice: 30,
			CacheReadPrice:  0.5,
			CacheWritePrice: 6.25,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}

	usage := &dto.Usage{
		PromptTokens:     89907,
		CompletionTokens: 1413,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:     81243,
			CacheWriteTokens: 8661,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 81243, summary.CacheTokens)
	require.Equal(t, 8661, summary.CacheCreationTokens)
	// uncached prompt = 89907 - 81243 - 8661 = 3
	// quota = 3*5 + 81243*0.5 + 8661*6.25 + 1413*30
	//       = 15 + 40621.5 + 54131.25 + 42390 = 137157.75 => 137158
	require.Equal(t, int64(137158), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryBillsExtractedChatCompletionUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	raw := []byte(`{
		"choices": [{"message": {"content": "Folding Portable Aluminum Picnic Table|neutral"}}],
		"object": "chat.completion",
		"usage": {
			"prompt_tokens": 585,
			"completion_tokens": 9,
			"total_tokens": 594
		}
	}`)
	var usage dto.Usage
	require.NoError(t, common.Unmarshal(raw, &usage))

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4.1-mini-2025-04-14",
		PriceData: types.PriceData{
			PromptPrice:     0.4,
			CompletionPrice: 0.8,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}
	summary := calculateTextQuotaSummary(ctx, relayInfo, &usage)
	require.Equal(t, 585, summary.PromptTokens)
	require.Equal(t, 9, summary.CompletionTokens)
	require.Equal(t, int64(241), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryBillsGptImageUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	raw := []byte(`{
		"background": "opaque",
		"data": "[{\"b64_json\":\"aaaa\"}]",
		"usage": {
			"input_tokens": 1248,
			"input_tokens_details": {"image_tokens": 1083, "text_tokens": 165},
			"output_tokens": 63,
			"total_tokens": 1311
		}
	}`)
	var usage dto.Usage
	require.NoError(t, common.Unmarshal(raw, &usage))
	usage.NormalizeInputTokenDetails()

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gpt-image-1",
		PriceData: types.PriceData{
			PromptPrice:     5,
			CompletionPrice: 40,
			ImagePrice:      10,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
	}
	summary := calculateTextQuotaSummary(ctx, relayInfo, &usage)
	require.Equal(t, 1248, summary.PromptTokens)
	require.Equal(t, 63, summary.CompletionTokens)
	require.Equal(t, 1083, summary.ImageTokens)
	// text 165*5 + image input 1083*10 + image output 63*40 = 825 + 10830 + 2520 = 14175
	require.Equal(t, int64(14175), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryBillsGoogleSearchAndImageOutput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.8-flash",
		PriceData: types.PriceData{
			PromptPrice:     0.75,
			CompletionPrice: 3.75,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1.3,
			},
		},
		StartTime: time.Now(),
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolGoogleSearch: {
					ToolName:  dto.BuildInToolGoogleSearch,
					CallCount: 1,
				},
				dto.BuildInToolGoogleSearchGroundedPrompt: {
					ToolName:  dto.BuildInToolGoogleSearchGroundedPrompt,
					CallCount: 1,
				},
			},
		},
	}
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 100,
		CompletionTokenDetails: dto.OutputTokenDetails{
			ImageTokens: 2000,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 2000, summary.ImageOutputTokens)
	require.Equal(t, 3.75, summary.ImageOutputPrice)
	require.Equal(t, 0.75, summary.PromptPrice)
	require.Equal(t, []ToolSurchargeItem{{
		Name:  dto.BuildInToolGoogleSearch,
		Count: 1,
		Price: 14,
	}}, summary.ToolSurchargeItems)
	// tokens (1000*0.75 + 100*3.75 + 2000*3.75) * 1.3 = 11212.5 → 11213
	// google_search 14/1000 * 1.3 dollars = 18200 microdollars
	require.Equal(t, int64(29413), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummarySubtractsImageOutputAlreadyInsideCompletion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gemini-2.5-flash",
		PriceData: types.PriceData{
			PromptPrice:     0.15,
			CompletionPrice: 0.6,
			ImagePrice:      30,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1,
			},
		},
		StartTime: time.Now(),
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
			BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
				dto.BuildInToolGoogleSearch: {
					ToolName:  dto.BuildInToolGoogleSearch,
					CallCount: 3,
				},
				dto.BuildInToolGoogleSearchGroundedPrompt: {
					ToolName:  dto.BuildInToolGoogleSearchGroundedPrompt,
					CallCount: 1,
				},
			},
		},
	}
	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 1390,
		CompletionTokenDetails: dto.OutputTokenDetails{
			ImageTokens: 1290,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 0.6, summary.ImageOutputPrice)
	require.Equal(t, []ToolSurchargeItem{{
		Name:  dto.BuildInToolGoogleSearchGroundedPrompt,
		Count: 1,
		Price: 35,
	}}, summary.ToolSurchargeItems)
	// text 100*0.15 + (1390-1290)*0.6 + image output 1290*0.6 = 15 + 60 + 774 = 849
	// grounded prompt 35/1000 dollars = 35000 microdollars
	require.Equal(t, int64(35849), summary.QuotaMicrodollars)
}

func TestCalculateTextQuotaSummaryBillsPromptImageAtInputAndOutputPrice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.8-flash",
		PriceData: types.PriceData{
			PromptPrice:     0.75,
			CompletionPrice: 3.75,
			GroupDiscountInfo: types.GroupDiscountInfo{
				GroupDiscount: 1.3,
			},
		},
		StartTime: time.Now(),
	}
	usage := &dto.Usage{
		PromptTokens:     1208,
		CompletionTokens: 8,
		PromptTokensDetails: dto.InputTokenDetails{
			ImageTokens: 1107,
			TextTokens:  101,
		},
	}

	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)
	require.Equal(t, 1107, summary.ImageTokens)
	require.Equal(t, 1107, summary.ImageBilledTokens)
	require.Equal(t, 0.75, summary.ImagePrice)
	// (101+1107)*0.75 + 8*3.75 = 906 + 30 = 936; *1.3 = 1216.8 → 1217
	require.Equal(t, int64(1217), summary.QuotaMicrodollars)
}
