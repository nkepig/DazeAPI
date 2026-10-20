package operation_setting

import "strings"

const (
	// Web search
	WebSearchPriceHigh = 25.00
	WebSearchPrice     = 10.00
	// File search
	FileSearchPrice = 2.5
)

const (
	GPTImage1Low1024x1024    = 0.011
	GPTImage1Low1024x1536    = 0.016
	GPTImage1Low1536x1024    = 0.016
	GPTImage1Medium1024x1024 = 0.042
	GPTImage1Medium1024x1536 = 0.063
	GPTImage1Medium1536x1024 = 0.063
	GPTImage1High1024x1024   = 0.167
	GPTImage1High1024x1536   = 0.25
	GPTImage1High1536x1024   = 0.25
)

const (
	// Gemini Audio Input Price
	Gemini25FlashPreviewInputAudioPrice     = 1.00
	Gemini25FlashProductionInputAudioPrice  = 1.00 // for `gemini-2.5-flash`
	Gemini25FlashLitePreviewInputAudioPrice = 0.50
	Gemini25FlashNativeAudioInputAudioPrice = 3.00
	Gemini20FlashInputAudioPrice            = 0.70
	GeminiRoboticsER15InputAudioPrice       = 1.00
)

const (
	// Claude Web search
	ClaudeWebSearchPrice = 10.00
)

func GetClaudeWebSearchPricePerThousand() float64 {
	return ClaudeWebSearchPrice
}

const (
	// Google Search grounding, USD per 1K calls.
	// Gemini 3 bills each unique search query at $14.
	// Gemini 2.5 and older bill $35 once per grounded prompt, and the query count is free.
	GoogleSearchPrice               = 14.0
	GoogleSearchGroundedPromptPrice = 35.0
)

type toolPricePrefix struct {
	tool   string
	prefix string
	price  float64
}

// Longer prefixes are matched first. A matched numeric zero is terminal:
// gemini-2.5 google_search is free even though the default is $14.
var toolPricePrefixes = []toolPricePrefix{
	{tool: "google_search", prefix: "gemini-2.5", price: 0},
	{tool: "google_search", prefix: "gemini-2.0", price: 0},
	{tool: "google_search", prefix: "gemini-1.5", price: 0},
	{tool: "google_search_grounded_prompt", prefix: "gemini-2.5", price: GoogleSearchGroundedPromptPrice},
	{tool: "google_search_grounded_prompt", prefix: "gemini-2.0", price: GoogleSearchGroundedPromptPrice},
	{tool: "google_search_grounded_prompt", prefix: "gemini-1.5", price: GoogleSearchGroundedPromptPrice},
}

// GetToolPriceForModel returns the price in USD per 1K calls.
// Lookup order: longest model-prefix override, then the tool default, then 0.
func GetToolPriceForModel(toolName, modelName string) float64 {
	bestLen := -1
	bestPrice := 0.0
	matched := false
	for _, entry := range toolPricePrefixes {
		if entry.tool != toolName || entry.prefix == "" {
			continue
		}
		if strings.HasPrefix(modelName, entry.prefix) && len(entry.prefix) > bestLen {
			bestLen = len(entry.prefix)
			bestPrice = entry.price
			matched = true
		}
	}
	if matched {
		return bestPrice
	}
	switch toolName {
	case "google_search":
		return GoogleSearchPrice
	case "web_search", "web_search_preview":
		return WebSearchPrice
	case "file_search":
		return FileSearchPrice
	default:
		return 0
	}
}

func GetWebSearchPricePerThousand(modelName string, contextSize string) float64 {
	// 确定模型类型
	// https://platform.openai.com/docs/pricing Web search 价格按模型类型收费
	// 新版计费规则不再关联 search context size，故在const区域将各size的价格设为一致。
	// gpt-5, gpt-5-mini, gpt-5-nano 和 o 系列模型价格为 10.00 美元/千次调用，产生额外 token 计入 input_tokens
	// gpt-4o, gpt-4.1, gpt-4o-mini 和 gpt-4.1-mini 价格为 25.00 美元/千次调用，不产生额外 token
	isNormalPriceModel :=
		strings.HasPrefix(modelName, "o3") ||
			strings.HasPrefix(modelName, "o4") ||
			strings.HasPrefix(modelName, "gpt-5")
	var priceWebSearchPerThousandCalls float64
	if isNormalPriceModel {
		priceWebSearchPerThousandCalls = WebSearchPrice
	} else {
		priceWebSearchPerThousandCalls = WebSearchPriceHigh
	}
	return priceWebSearchPerThousandCalls
}

func GetFileSearchPricePerThousand() float64 {
	return FileSearchPrice
}

func GetGPTImage1PriceOnceCall(quality string, size string) float64 {
	prices := map[string]map[string]float64{
		"low": {
			"1024x1024": GPTImage1Low1024x1024,
			"1024x1536": GPTImage1Low1024x1536,
			"1536x1024": GPTImage1Low1536x1024,
		},
		"medium": {
			"1024x1024": GPTImage1Medium1024x1024,
			"1024x1536": GPTImage1Medium1024x1536,
			"1536x1024": GPTImage1Medium1536x1024,
		},
		"high": {
			"1024x1024": GPTImage1High1024x1024,
			"1024x1536": GPTImage1High1024x1536,
			"1536x1024": GPTImage1High1536x1024,
		},
	}

	if qualityMap, exists := prices[quality]; exists {
		if price, exists := qualityMap[size]; exists {
			return price
		}
	}

	return GPTImage1High1024x1024
}
