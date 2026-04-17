package types

import "fmt"

type ProviderRatioInfo struct {
	ProviderRatio float64
}

type GroupRatioInfo struct {
	GroupRatio        float64
	GroupSpecialRatio float64
	HasSpecialRatio   bool
}

// GroupDiscountInfo holds per-model group discount data.
// GroupDiscount is a multiplier: 1.0 = full price, 0.8 = 20% off.
type GroupDiscountInfo struct {
	GroupDiscount     float64 // base group discount
	GroupSpecialRatio float64 // per-model override (negative = not set)
	HasSpecialRatio  bool
}

type PriceData struct {
	FreeModel bool

	// Dollar-based pricing fields ($/1M tokens)
	PromptPrice       float64
	CompletionPrice   float64
	CacheReadPrice    float64
	CacheWritePrice   float64
	CacheWrite5mPrice float64
	CacheWrite1hPrice float64
	ImagePrice         float64
	AudioInputPrice   float64
	AudioOutputPrice  float64
	PerCallPrice      float64
	UsePerCallPricing bool

	// Group discount multiplier (1.0 = full price, 0.8 = 20% off)
	GroupDiscountInfo GroupDiscountInfo
	ProviderRatioInfo ProviderRatioInfo
	OtherDiscounts    map[string]float64
	OtherRatios       map[string]float64 // Task billing multipliers (seconds, size, resolution)

	// Deprecated: use GroupDiscountInfo.GroupDiscount instead
	// Kept for backward compatibility during migration
	ModelPrice           float64
	ModelRatio           float64
	CompletionRatio      float64
	CacheRatio           float64
	CacheCreationRatio   float64
	CacheCreation5mRatio float64
	CacheCreation1hRatio float64
	ImageRatio           float64
	AudioRatio           float64
	AudioCompletionRatio float64
	UsePrice             bool
	Quota                int
	QuotaToPreConsume    int
	GroupRatioInfo       GroupRatioInfo
}

func (p *PriceData) AddOtherRatio(key string, ratio float64) {
	if p.OtherDiscounts == nil {
		p.OtherDiscounts = make(map[string]float64)
	}
	if ratio <= 0 {
		return
	}
	p.OtherDiscounts[key] = ratio
}

func (p *PriceData) ToSetting() string {
	return fmt.Sprintf("PromptPrice: %f, CompletionPrice: %f, CacheReadPrice: %f, CacheWritePrice: %f, GroupDiscount: %f, UsePerCallPricing: %t, PerCallPrice: %f, ImagePrice: %f, AudioInputPrice: %f, AudioOutputPrice: %f", p.PromptPrice, p.CompletionPrice, p.CacheReadPrice, p.CacheWritePrice, p.GroupDiscountInfo.GroupDiscount, p.UsePerCallPricing, p.PerCallPrice, p.ImagePrice, p.AudioInputPrice, p.AudioOutputPrice)
}