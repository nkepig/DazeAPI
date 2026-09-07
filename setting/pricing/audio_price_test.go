package pricing

import "testing"

func TestMergeDefaultAudioPrices(t *testing.T) {
	saved := ModelPricing{PromptPrice: 5, CompletionPrice: 20}
	got := mergeDefaultAudioPrices("gpt-4o-realtime-preview", saved)
	if got.AudioInputPrice != 40 {
		t.Fatalf("audio input = %v, want 40", got.AudioInputPrice)
	}
	if got.AudioOutputPrice != 80 {
		t.Fatalf("audio output = %v, want 80", got.AudioOutputPrice)
	}
	if got.PromptPrice != 5 || got.CompletionPrice != 20 {
		t.Fatalf("text prices mutated: %+v", got)
	}
}

func TestMergeDefaultAudioPricesKeepsExplicitOverride(t *testing.T) {
	saved := ModelPricing{
		PromptPrice:      5,
		CompletionPrice:  20,
		AudioInputPrice:  12,
		AudioOutputPrice: 24,
	}
	got := mergeDefaultAudioPrices("gpt-4o-realtime-preview", saved)
	if got.AudioInputPrice != 12 || got.AudioOutputPrice != 24 {
		t.Fatalf("explicit audio prices overwritten: %+v", got)
	}
}
