package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestApplyOpenAIResponsesUsageCopiesCacheWriteTokens(t *testing.T) {
	src := &dto.Usage{
		InputTokens:  89907,
		OutputTokens: 1413,
		TotalTokens:  91320,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:     81243,
			CacheWriteTokens: 8661,
		},
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)

	if dst.PromptTokens != 89907 {
		t.Fatalf("PromptTokens=%d want 89907", dst.PromptTokens)
	}
	if dst.PromptTokensDetails.CachedTokens != 81243 {
		t.Fatalf("CachedTokens=%d want 81243", dst.PromptTokensDetails.CachedTokens)
	}
	if dst.PromptTokensDetails.CachedCreationTokens != 8661 {
		t.Fatalf("CachedCreationTokens=%d want 8661", dst.PromptTokensDetails.CachedCreationTokens)
	}
	if dst.PromptTokensDetails.CacheWriteTokens != 8661 {
		t.Fatalf("CacheWriteTokens=%d want 8661", dst.PromptTokensDetails.CacheWriteTokens)
	}
}

func TestApplyOpenAIResponsesUsageCopiesNonCachePromptDetails(t *testing.T) {
	src := &dto.Usage{
		InputTokens:  120,
		OutputTokens: 10,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens:  80,
			AudioTokens: 25,
			ImageTokens: 15,
		},
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)

	if dst.PromptTokensDetails.TextTokens != 80 {
		t.Fatalf("TextTokens=%d want 80", dst.PromptTokensDetails.TextTokens)
	}
	if dst.PromptTokensDetails.AudioTokens != 25 {
		t.Fatalf("AudioTokens=%d want 25", dst.PromptTokensDetails.AudioTokens)
	}
	if dst.PromptTokensDetails.ImageTokens != 15 {
		t.Fatalf("ImageTokens=%d want 15", dst.PromptTokensDetails.ImageTokens)
	}
}
