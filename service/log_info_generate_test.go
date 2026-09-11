package service

import (
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
