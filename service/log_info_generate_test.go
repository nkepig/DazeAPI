package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func TestAttachUsageDictKeepsOriginalJSON(t *testing.T) {
	raw := []byte(`{
		"prompt_tokens": 658,
		"completion_tokens": 531,
		"total_tokens": 1189,
		"prompt_tokens_details": {
			"cached_tokens": 512,
			"text_tokens": 658,
			"audio_tokens": 0,
			"image_tokens": 0
		},
		"completion_tokens_details": {
			"text_tokens": 8,
			"audio_tokens": 0,
			"reasoning_tokens": 523
		},
		"input_tokens": 0,
		"output_tokens": 0,
		"input_tokens_details": null,
		"claude_cache_creation_5_m_tokens": 0,
		"claude_cache_creation_1_h_tokens": 0
	}`)
	var usage dto.Usage
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}

	other := map[string]interface{}{}
	AttachUsageDict(other, &usage)
	stored, ok := other["usage"].(map[string]interface{})
	if !ok {
		t.Fatal("usage dict missing")
	}
	if stored["prompt_tokens"] != float64(658) {
		t.Fatalf("prompt_tokens=%v", stored["prompt_tokens"])
	}
	if stored["input_tokens"] != float64(0) {
		t.Fatalf("input_tokens=%v, want 0", stored["input_tokens"])
	}
	if stored["input_tokens_details"] != nil {
		t.Fatalf("input_tokens_details=%v, want null", stored["input_tokens_details"])
	}
	details, ok := stored["prompt_tokens_details"].(map[string]interface{})
	if !ok {
		t.Fatal("prompt_tokens_details missing")
	}
	if details["audio_tokens"] != float64(0) {
		t.Fatalf("audio_tokens=%v, want 0", details["audio_tokens"])
	}
	outDetails, ok := stored["completion_tokens_details"].(map[string]interface{})
	if !ok {
		t.Fatal("completion_tokens_details missing")
	}
	if outDetails["reasoning_tokens"] != float64(523) {
		t.Fatalf("reasoning_tokens=%v", outDetails["reasoning_tokens"])
	}
	if _, exists := stored["usage_source"]; exists {
		t.Fatal("gateway-only usage_source should not be injected into original usage")
	}
}

func TestAttachUsageDictNilSafe(t *testing.T) {
	AttachUsageDict(nil, &dto.Usage{PromptTokens: 1})
	other := map[string]interface{}{}
	AttachUsageDict(other, nil)
	if _, exists := other["usage"]; exists {
		t.Fatal("nil usage should not be stored")
	}
}

func TestAttachUsageDictUnwrapsResponseAndClipsLongFields(t *testing.T) {
	longContent := strings.Repeat("A", 250)
	raw := []byte(`{
		"choices": [{"message": {"content": "` + longContent + `"}}],
		"object": "chat.completion",
		"usage": {
			"prompt_tokens": 585,
			"completion_tokens": 9,
			"total_tokens": 594,
			"dump": "` + longContent + `"
		}
	}`)
	var usage dto.Usage
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}
	other := map[string]interface{}{}
	AttachUsageDict(other, &usage)
	stored, ok := other["usage"].(map[string]interface{})
	if !ok {
		t.Fatal("usage dict missing")
	}
	if _, exists := stored["choices"]; exists {
		t.Fatal("choices should be stripped from stored usage")
	}
	if stored["prompt_tokens"] != float64(585) {
		t.Fatalf("prompt_tokens=%v", stored["prompt_tokens"])
	}
	dump, _ := stored["dump"].(string)
	if len([]rune(dump)) != 201 {
		t.Fatalf("dump len=%d want 201 (200 + ellipsis), value=%q", len([]rune(dump)), dump)
	}
}

func TestAttachUsageDictKeepsGeminiUsageMetadata(t *testing.T) {
	usage := dto.Usage{
		PromptTokens:     24744,
		CompletionTokens: 4057,
		OriginalUsageJSON: []byte(`{
			"promptTokenCount": 24744,
			"candidatesTokenCount": 4057,
			"totalTokenCount": 28801,
			"candidatesTokensDetails": [{"modality": "IMAGE", "tokenCount": 2335392}]
		}`),
	}
	other := map[string]interface{}{}
	AttachUsageDict(other, &usage)
	stored, ok := other["usage"].(map[string]interface{})
	if !ok {
		t.Fatal("usage dict missing")
	}
	if stored["promptTokenCount"] != float64(24744) {
		t.Fatalf("promptTokenCount=%v", stored["promptTokenCount"])
	}
	if _, exists := stored["prompt_tokens"]; exists {
		t.Fatal("converted usage replaced usageMetadata")
	}
	details, ok := stored["candidatesTokensDetails"].([]interface{})
	if !ok || len(details) != 1 {
		t.Fatalf("candidatesTokensDetails=%v", stored["candidatesTokensDetails"])
	}
}

func TestSanitizeUsageDictUnwrapsGeminiResponse(t *testing.T) {
	raw := map[string]interface{}{
		"candidates": []interface{}{},
		"usageMetadata": map[string]interface{}{
			"promptTokenCount":        float64(24744),
			"candidatesTokenCount":    float64(4057),
			"candidatesTokensDetails": []interface{}{},
		},
	}
	got := SanitizeUsageDict(raw)
	if got["promptTokenCount"] != float64(24744) {
		t.Fatalf("promptTokenCount=%v", got["promptTokenCount"])
	}
	if _, exists := got["candidates"]; exists {
		t.Fatal("gemini response envelope should be unwrapped to usageMetadata")
	}
}

func TestAttachUsageDictUnwrapsImageResponse(t *testing.T) {
	raw := []byte(`{
		"background": "opaque",
		"data": "[{\"b64_json\":\"iVBORw0KGgoAAAANSUhEUgAAByAAAAJgCAIAAABN5ONl\"}]",
		"usage": {
			"input_tokens": 1248,
			"output_tokens": 63,
			"total_tokens": 1311
		}
	}`)
	var usage dto.Usage
	if err := common.Unmarshal(raw, &usage); err != nil {
		t.Fatal(err)
	}
	other := map[string]interface{}{}
	AttachUsageDict(other, &usage)
	stored, ok := other["usage"].(map[string]interface{})
	if !ok {
		t.Fatal("usage dict missing")
	}
	if _, exists := stored["data"]; exists {
		t.Fatal("image payload should not be stored in usage")
	}
	if stored["input_tokens"] != float64(1248) {
		t.Fatalf("input_tokens=%v", stored["input_tokens"])
	}
}
