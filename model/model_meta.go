package model

// Model represents model metadata used for pricing UI display.
// The underlying table is "models"; queries gracefully return empty if table is absent.
type Model struct {
	Id          int    `gorm:"primaryKey;autoIncrement"`
	ModelName   string `gorm:"type:varchar(255);uniqueIndex"`
	VendorID    int
	Status      int
	NameRule    string `gorm:"type:varchar(32)"`
	Description string `gorm:"type:text"`
	Icon        string `gorm:"type:varchar(255)"`
	Tags        string `gorm:"type:text"`
	Endpoints   string `gorm:"type:text"`
	CreatedAt   int64
	UpdatedAt   int64
}

const (
	NameRuleExact    = "exact"
	NameRulePrefix   = "prefix"
	NameRuleSuffix   = "suffix"
	NameRuleContains = "contains"
)

// SubscriptionPlan is a stub retained for auto-migration compatibility.
// The subscription feature has been removed; this struct prevents migration from failing.
type SubscriptionPlan struct {
	Id        int    `gorm:"primaryKey;autoIncrement"`
	Title     string `gorm:"type:varchar(128)"`
	Enabled   bool
	CreatedAt int64
	UpdatedAt int64
}
