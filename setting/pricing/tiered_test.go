package pricing

import "testing"

func int64Ptr(v int64) *int64 { return &v }

func TestSelectTier(t *testing.T) {
	mp := ModelPricing{
		BillingMode: BillingModeTiered,
		Tiers: []PricingTier{
			{MaxLen: nil, PromptPrice: 6, CompletionPrice: 22.5, CacheReadPrice: 0.6, CacheWritePrice: 7.5},
			{MaxLen: int64Ptr(200000), PromptPrice: 3, CompletionPrice: 15, CacheReadPrice: 0.3, CacheWritePrice: 3.75},
			{MaxLen: int64Ptr(32000), PromptPrice: 1, CompletionPrice: 5, CacheReadPrice: 0.1, CacheWritePrice: 1.25},
		},
	}

	cases := []struct {
		len    int
		want   string
		wantIn float64
		wantCR float64
	}{
		{0, "<=32000", 1, 0.1},
		{32000, "<=32000", 1, 0.1},
		{32001, "<=200000", 3, 0.3},
		{200000, "<=200000", 3, 0.3},
		{200001, "∞", 6, 0.6},
	}
	for _, tc := range cases {
		got, ok := mp.SelectTier(tc.len)
		if !ok {
			t.Fatalf("len=%d: expected match", tc.len)
		}
		if got.Label() != tc.want {
			t.Fatalf("len=%d: label got %q want %q", tc.len, got.Label(), tc.want)
		}
		if got.PromptPrice != tc.wantIn || got.CacheReadPrice != tc.wantCR {
			t.Fatalf("len=%d: prices got in=%v cr=%v", tc.len, got.PromptPrice, got.CacheReadPrice)
		}
	}
}

func TestInputContextLength(t *testing.T) {
	if got := InputContextLength(1000, 200, 100, false); got != 1000 {
		t.Fatalf("openai len=%d want 1000", got)
	}
	if got := InputContextLength(700, 200, 100, true); got != 1000 {
		t.Fatalf("claude len=%d want 1000", got)
	}
}
