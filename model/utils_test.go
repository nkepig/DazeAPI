package model

import (
	"strings"
	"testing"
)

func TestBatchSingleColumnSQL(t *testing.T) {
	got := batchSingleColumnSQL("users", "quota", map[int]int{24: -100, 10: 50})
	want := "UPDATE users SET quota = CASE id WHEN 10 THEN quota + 50 WHEN 24 THEN quota + -100 END WHERE id IN (10,24)"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestBatchTokenQuotaSQL(t *testing.T) {
	got := batchTokenQuotaSQL(map[int]int{133: -3071887, 10: -14700}, 1786615438)
	want := "UPDATE tokens SET remain_quota = CASE id WHEN 10 THEN remain_quota + -14700 WHEN 133 THEN remain_quota + -3071887 END, used_quota = CASE id WHEN 10 THEN used_quota - -14700 WHEN 133 THEN used_quota - -3071887 END, accessed_time = 1786615438 WHERE id IN (10,133)"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	if strings.Contains(got, " SET quota ") || strings.Contains(got, "THEN quota ") {
		t.Fatal("token batch SQL must not reference tokens.quota")
	}
}
