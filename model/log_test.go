package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// formatUserLogs must strip channel_name (top-level and inside
// admin_info.retry_attempts[]) so users reading their own logs cannot see
// the channel name. admin_info, reject_reason, and model redirect fields
// (is_model_mapped / upstream_model_name) are also not exposed to users.
func TestFormatUserLogs_StripsChannelName(t *testing.T) {
	other := map[string]interface{}{
		"channel_id":          4,
		"channel_name":        "gemini-sunshine",
		"error_code":          "429",
		"reject_reason":       "quota",
		"is_model_mapped":     true,
		"upstream_model_name": "openai/gpt-5.5",
		"admin_info": map[string]interface{}{
			"use_channel": []interface{}{"23", "4"},
			"retry_attempts": []interface{}{
				map[string]interface{}{
					"retry_index":  0,
					"channel_id":   23,
					"channel_name": "gemini-image-mian",
					"status_code":  429,
				},
			},
		},
	}
	otherStr := common.MapToJsonStr(other)
	logs := []*Log{{Other: otherStr, ChannelName: "gemini-sunshine"}}
	formatUserLogs(logs, 0)

	if logs[0].ChannelName != "" {
		t.Errorf("ChannelName column must be cleared for users, got %q", logs[0].ChannelName)
	}
	var got map[string]interface{}
	if err := json.Unmarshal([]byte(logs[0].Other), &got); err != nil {
		t.Fatalf("other is not valid json: %v", err)
	}
	if _, ok := got["channel_name"]; ok {
		t.Errorf("top-level channel_name must be stripped from other for users")
	}
	if _, ok := got["admin_info"]; ok {
		t.Errorf("admin_info must be stripped from other for users")
	}
	if _, ok := got["reject_reason"]; ok {
		t.Errorf("reject_reason must be stripped from other for users")
	}
	if _, ok := got["is_model_mapped"]; ok {
		t.Errorf("is_model_mapped must be stripped from other for users")
	}
	if _, ok := got["upstream_model_name"]; ok {
		t.Errorf("upstream_model_name must be stripped from other for users")
	}
	if v, ok := got["channel_id"]; !ok || v != float64(4) {
		t.Errorf("channel_id must be preserved, got %v", got["channel_id"])
	}
	if _, ok := got["error_code"]; !ok {
		t.Errorf("non-sensitive fields must be preserved")
	}
}
