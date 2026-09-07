package pricing

import (
	"fmt"
	"sort"
)

const BillingModeTiered = "tiered"

// PricingTier is one length-based pricing package.
// MaxLen is the inclusive upper bound of input context length (tokens).
// A nil MaxLen means unlimited (∞) and is used as the fallback tier.
type PricingTier struct {
	MaxLen          *int64  `json:"max_len,omitempty"`
	PromptPrice     float64 `json:"prompt_price"`
	CompletionPrice float64 `json:"completion_price"`
	CacheReadPrice  float64 `json:"cache_read_price,omitempty"`
	CacheWritePrice float64 `json:"cache_write_price,omitempty"`
}

// Label returns a short identifier for logs / UI (e.g. "<=128000" or "∞").
func (t PricingTier) Label() string {
	if t.MaxLen == nil {
		return "∞"
	}
	return fmt.Sprintf("<=%d", *t.MaxLen)
}

// IsTiered reports whether this model uses length-based tier packages.
func (p ModelPricing) IsTiered() bool {
	return p.BillingMode == BillingModeTiered && len(p.Tiers) > 0
}

// HasTierPrices reports whether at least one tier has a usable price.
func (p ModelPricing) HasTierPrices() bool {
	for _, tier := range p.Tiers {
		if tier.PromptPrice != 0 || tier.CompletionPrice != 0 ||
			tier.CacheReadPrice != 0 || tier.CacheWritePrice != 0 {
			return true
		}
	}
	return false
}

// SelectTier picks the first matching package for the given input context length.
// Tiers with MaxLen are checked ascending; unlimited (nil MaxLen / ∞) is the fallback.
func (p ModelPricing) SelectTier(inputLen int) (PricingTier, bool) {
	if !p.IsTiered() {
		return PricingTier{}, false
	}

	tiers := append([]PricingTier(nil), p.Tiers...)
	sort.SliceStable(tiers, func(i, j int) bool {
		a, b := tiers[i].MaxLen, tiers[j].MaxLen
		if a == nil && b == nil {
			return false
		}
		if a == nil {
			return false
		}
		if b == nil {
			return true
		}
		return *a < *b
	})

	lenTokens := int64(inputLen)
	if lenTokens < 0 {
		lenTokens = 0
	}

	var fallback *PricingTier
	for i := range tiers {
		tier := &tiers[i]
		if tier.MaxLen == nil {
			if fallback == nil {
				fallback = tier
			}
			continue
		}
		if lenTokens <= *tier.MaxLen {
			return *tier, true
		}
	}
	if fallback != nil {
		return *fallback, true
	}
	// No unlimited tier: use the last (highest) bounded tier.
	if len(tiers) > 0 {
		return tiers[len(tiers)-1], true
	}
	return PricingTier{}, false
}

// InputContextLength returns the length used for tier conditions.
// OpenAI-format: raw prompt_tokens.
// Claude-format: text input + cache read + cache creation.
func InputContextLength(promptTokens, cacheReadTokens, cacheCreationTokens int, isClaude bool) int {
	if !isClaude {
		if promptTokens < 0 {
			return 0
		}
		return promptTokens
	}
	total := promptTokens + cacheReadTokens + cacheCreationTokens
	if total < 0 {
		return 0
	}
	return total
}
