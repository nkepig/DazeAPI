package claude

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestChatUsageFromModelResponseUsesCompletionTokens(t *testing.T) {
	raw := []byte(`{
		"id": "msg_bdrk_test",
		"model": "claude-opus-4-8",
		"object": "chat.completion",
		"created": 1791871965,
		"choices": [{
			"index": 0,
			"message": {"role": "assistant", "content": "hello"},
			"finish_reason": "length"
		}],
		"usage": {
			"prompt_tokens": 42,
			"completion_tokens": 16,
			"total_tokens": 58,
			"usage_semantic": "openai",
			"usage_source": "anthropic",
			"input_tokens": 42,
			"output_tokens": 0,
			"prompt_tokens_details": {"cached_tokens": 0},
			"completion_tokens_details": {"reasoning_tokens": 0}
		}
	}`)

	usage := chatUsageFromModelResponse(raw)
	if usage == nil {
		t.Fatal("expected chat usage")
	}
	if usage.PromptTokens != 42 || usage.CompletionTokens != 16 {
		t.Fatalf("tokens=%d/%d want 42/16", usage.PromptTokens, usage.CompletionTokens)
	}
	if usage.UsageSemantic != "openai" {
		t.Fatalf("semantic=%s want openai", usage.UsageSemantic)
	}
	if usage.UsageSource != "anthropic" {
		t.Fatalf("source=%s want anthropic", usage.UsageSource)
	}
}

func TestNativeMessageUsageKeepsOutputTokens(t *testing.T) {
	raw := []byte(`{
		"model": "claude-opus-4-7",
		"id": "msg_bdrk_test",
		"type": "message",
		"role": "assistant",
		"content": [{"type": "text", "text": "hello"}],
		"stop_reason": "max_tokens",
		"usage": {
			"input_tokens": 47,
			"cache_creation_input_tokens": 0,
			"cache_read_input_tokens": 0,
			"cache_creation": {"ephemeral_5m_input_tokens": 0, "ephemeral_1h_input_tokens": 0},
			"output_tokens": 16,
			"output_tokens_details": {"thinking_tokens": 0},
			"service_tier": "standard"
		}
	}`)
	if chatUsageFromModelResponse(raw) != nil {
		t.Fatal("native message usage must not be read as chat completion usage")
	}
	var resp dto.ClaudeResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatal(err)
	}
	usage := &dto.Usage{}
	applyNativeClaudeUsage(usage, resp.Usage, claudeUsageJSON(raw))
	if usage.PromptTokens != 47 || usage.CompletionTokens != 16 || usage.OutputTokens != 16 {
		t.Fatalf("tokens prompt=%d completion=%d output=%d", usage.PromptTokens, usage.CompletionTokens, usage.OutputTokens)
	}
	if !bytes.Contains(usage.OriginalUsageJSON, []byte(`"output_tokens": 16`)) && !bytes.Contains(usage.OriginalUsageJSON, []byte(`"output_tokens":16`)) {
		t.Fatalf("original usage = %s", usage.OriginalUsageJSON)
	}
	if !bytes.Contains(usage.OriginalUsageJSON, []byte("thinking_tokens")) {
		t.Fatalf("original usage dropped thinking_tokens: %s", usage.OriginalUsageJSON)
	}
}
