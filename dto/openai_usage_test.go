package dto

import (
	"bytes"
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

func TestUsageUnmarshalExtractsNestedChatCompletion(t *testing.T) {
	raw := []byte(`{
		"choices": [
			{
				"finish_reason": "stop",
				"index": 0,
				"message": {"content": "hello", "role": "assistant"}
			}
		],
		"created": 1789127753,
		"id": "chatcmpl-test",
		"model": "gpt-4.1-mini-2025-04-14",
		"object": "chat.completion",
		"usage": {
			"completion_tokens": 9,
			"prompt_tokens": 585,
			"total_tokens": 594,
			"completion_tokens_details": {
				"reasoning_tokens": 0
			}
		}
	}`)
	var usage Usage
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}
	if usage.PromptTokens != 585 {
		t.Fatalf("PromptTokens=%d want 585", usage.PromptTokens)
	}
	if usage.CompletionTokens != 9 {
		t.Fatalf("CompletionTokens=%d want 9", usage.CompletionTokens)
	}
	if usage.TotalTokens != 594 {
		t.Fatalf("TotalTokens=%d want 594", usage.TotalTokens)
	}
	if !bytes.Contains(usage.OriginalUsageJSON, []byte(`"prompt_tokens"`)) {
		t.Fatalf("OriginalUsageJSON missing prompt_tokens: %s", usage.OriginalUsageJSON)
	}
	if bytes.Contains(usage.OriginalUsageJSON, []byte(`"choices"`)) {
		t.Fatalf("OriginalUsageJSON should not keep response envelope: %s", usage.OriginalUsageJSON)
	}
}

func TestOpenAITextResponseUsageKeepsTokens(t *testing.T) {
	raw := []byte(`{
		"id": "chatcmpl-test",
		"object": "chat.completion",
		"created": 1,
		"model": "gpt-4.1-mini-2025-04-14",
		"choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "hi"}}],
		"usage": {"prompt_tokens": 585, "completion_tokens": 9, "total_tokens": 594}
	}`)
	var resp OpenAITextResponse
	if err := common.Unmarshal(raw, &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Usage.PromptTokens != 585 {
		t.Fatalf("PromptTokens=%d want 585", resp.Usage.PromptTokens)
	}
	if resp.Usage.CompletionTokens != 9 {
		t.Fatalf("CompletionTokens=%d want 9", resp.Usage.CompletionTokens)
	}
}

func TestUsageUnmarshalExtractsNestedImageResponse(t *testing.T) {
	raw := []byte(`{
		"background": "opaque",
		"created": 1789129080,
		"data": "[{\"b64_json\":\"iVBORw0KGgoAAAANSUhEUgAAByAAAAJgCAIAAABN5ONlAABVVGNhQlgAAFVUanVtYg\"}]",
		"output_format": "png",
		"quality": "low",
		"size": "1824x608",
		"usage": {
			"input_tokens": 1248,
			"input_tokens_details": {
				"image_tokens": 1083,
				"text_tokens": 165
			},
			"output_tokens": 63,
			"output_tokens_details": {
				"image_tokens": 63,
				"text_tokens": 0
			},
			"total_tokens": 1311
		}
	}`)
	var usage Usage
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}
	if usage.PromptTokens != 1248 {
		t.Fatalf("PromptTokens=%d want 1248", usage.PromptTokens)
	}
	if usage.CompletionTokens != 63 {
		t.Fatalf("CompletionTokens=%d want 63", usage.CompletionTokens)
	}
	if bytes.Contains(usage.OriginalUsageJSON, []byte("b64_json")) {
		t.Fatalf("OriginalUsageJSON should not keep image payload: %s", usage.OriginalUsageJSON)
	}
	usage.NormalizeInputTokenDetails()
	if usage.PromptTokensDetails.ImageTokens != 1083 {
		t.Fatalf("ImageTokens=%d want 1083", usage.PromptTokensDetails.ImageTokens)
	}
}
