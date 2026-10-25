package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestGetConsumeLogUsageRequestIDSelectsConsumeLog(t *testing.T) {
	requestID := "usage-query-regression"
	LOG_DB.Where("request_id = ?", requestID).Delete(&Log{})
	defer LOG_DB.Where("request_id = ?", requestID).Delete(&Log{})

	consumeLog := Log{
		Type:      LogTypeConsume,
		RequestId: requestID,
		Other:     `{"usage":{"input_tokens":4406,"output_tokens":1,"total_tokens":4407}}`,
	}
	if err := LOG_DB.Create(&consumeLog).Error; err != nil {
		t.Fatal(err)
	}
	newerErrorLog := Log{
		Type:      LogTypeError,
		RequestId: requestID,
		Other:     `{"error":"upstream error"}`,
	}
	if err := LOG_DB.Create(&newerErrorLog).Error; err != nil {
		t.Fatal(err)
	}

	usage, err := GetConsumeLogUsage(ConsumeLogUsageQuery{RequestId: requestID})
	if err != nil {
		t.Fatal(err)
	}
	if usage["input_tokens"] != float64(4406) || usage["output_tokens"] != float64(1) {
		t.Fatalf("usage=%v, want consume log usage", usage)
	}
}

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
