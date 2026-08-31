package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestResponsesToChatCopiesCacheWriteTokens(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		ID:    "resp_1",
		Model: "gpt-5.6-sol",
		Usage: &dto.Usage{
			InputTokens:  89907,
			OutputTokens: 1413,
			TotalTokens:  91320,
			InputTokensDetails: &dto.InputTokenDetails{
				CachedTokens:     81243,
				CacheWriteTokens: 8661,
			},
		},
	}

	_, usage, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	if err != nil {
		t.Fatal(err)
	}
	if usage.PromptTokensDetails.CachedTokens != 81243 {
		t.Fatalf("CachedTokens=%d want 81243", usage.PromptTokensDetails.CachedTokens)
	}
	if usage.PromptTokensDetails.CachedCreationTokens != 8661 {
		t.Fatalf("CachedCreationTokens=%d want 8661", usage.PromptTokensDetails.CachedCreationTokens)
	}
	if usage.PromptTokensDetails.CacheWriteTokens != 8661 {
		t.Fatalf("CacheWriteTokens=%d want 8661", usage.PromptTokensDetails.CacheWriteTokens)
	}
}
