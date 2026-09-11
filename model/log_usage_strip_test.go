package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestStripUsageFromLogsKeepsHasUsageFlag(t *testing.T) {
	logs := []*Log{
		{
			Other: `{"quota":1,"usage":{"prompt_tokens":1,"input_tokens":0,"input_tokens_details":null}}`,
		},
		{
			Other: `{"quota":2}`,
		},
	}
	stripUsageFromLogs(logs)

	first, _ := common.StrToMap(logs[0].Other)
	if _, ok := first["usage"]; ok {
		t.Fatal("usage should be stripped from list payload")
	}
	if first["has_usage"] != true {
		t.Fatalf("has_usage=%v, want true", first["has_usage"])
	}
	if first["quota"] != float64(1) {
		t.Fatalf("quota=%v, want 1", first["quota"])
	}

	second := logs[1].Other
	if second != `{"quota":2}` {
		t.Fatalf("logs without usage should stay unchanged, got %s", second)
	}
}

func TestFormatUserLogsStripsUsage(t *testing.T) {
	logs := []*Log{
		{
			Id:    99,
			Other: `{"channel_name":"hidden","usage":{"prompt_tokens":3}}`,
		},
	}
	formatUserLogs(logs, 0)
	other, _ := common.StrToMap(logs[0].Other)
	if _, ok := other["usage"]; ok {
		t.Fatal("usage should be stripped from self-service list payload")
	}
	if other["has_usage"] != true {
		t.Fatalf("has_usage=%v, want true", other["has_usage"])
	}
	if _, ok := other["channel_name"]; ok {
		t.Fatal("channel_name should still be stripped")
	}
	if logs[0].Id != 1 {
		t.Fatalf("id rewritten to display index, got %d", logs[0].Id)
	}
}
