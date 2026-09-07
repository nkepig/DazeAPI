package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestNormalizeInputTokenDetailsFromResponsesCacheWrite(t *testing.T) {
	var usage Usage
	raw := []byte(`{
		"input_tokens": 89907,
		"output_tokens": 1413,
		"total_tokens": 91320,
		"input_tokens_details": {
			"cached_tokens": 81243,
			"cache_write_tokens": 8661
		}
	}`)
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}

	usage.NormalizeInputTokenDetails()

	if usage.PromptTokensDetails.CachedTokens != 81243 {
		t.Fatalf("cached_tokens=%d want 81243", usage.PromptTokensDetails.CachedTokens)
	}
	if usage.PromptTokensDetails.CachedCreationTokens != 8661 {
		t.Fatalf("cached_creation_tokens=%d want 8661", usage.PromptTokensDetails.CachedCreationTokens)
	}
	if usage.PromptTokensDetails.CacheWriteTokens != 8661 {
		t.Fatalf("cache_write_tokens=%d want 8661", usage.PromptTokensDetails.CacheWriteTokens)
	}
}

func TestNormalizeInputTokenDetailsFromChatCompletionsCacheWrite(t *testing.T) {
	var usage Usage
	raw := []byte(`{
		"prompt_tokens": 89907,
		"completion_tokens": 1413,
		"prompt_tokens_details": {
			"cached_tokens": 81243,
			"cache_write_tokens": 8661
		}
	}`)
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}

	usage.NormalizeInputTokenDetails()

	if usage.PromptTokensDetails.CachedCreationTokens != 8661 {
		t.Fatalf("cached_creation_tokens=%d want 8661", usage.PromptTokensDetails.CachedCreationTokens)
	}
}

func TestNormalizeInputTokenDetailsKeepsCachedCreationAlias(t *testing.T) {
	usage := Usage{
		PromptTokensDetails: InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
	}
	usage.NormalizeInputTokenDetails()
	if usage.PromptTokensDetails.CacheWriteTokens != 50 {
		t.Fatalf("cache_write_tokens=%d want 50", usage.PromptTokensDetails.CacheWriteTokens)
	}
	if usage.PromptTokensDetails.CachedCreationTokens != 50 {
		t.Fatalf("cached_creation_tokens=%d want 50", usage.PromptTokensDetails.CachedCreationTokens)
	}
}
