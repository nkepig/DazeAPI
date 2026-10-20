package operation_setting

import "testing"

func TestGetToolPriceForModelGoogleSearch(t *testing.T) {
	if got := GetToolPriceForModel("google_search", "gemini-3.8-flash"); got != 14 {
		t.Fatalf("gemini 3 google_search price = %v, want 14", got)
	}
	if got := GetToolPriceForModel("google_search_grounded_prompt", "gemini-3.8-flash"); got != 0 {
		t.Fatalf("gemini 3 grounded prompt price = %v, want 0", got)
	}
	if got := GetToolPriceForModel("google_search", "gemini-2.5-flash"); got != 0 {
		t.Fatalf("gemini 2.5 google_search price = %v, want 0", got)
	}
	if got := GetToolPriceForModel("google_search_grounded_prompt", "gemini-2.5-flash"); got != 35 {
		t.Fatalf("gemini 2.5 grounded prompt price = %v, want 35", got)
	}
}
