package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupTokenTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Token{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	DB = db
}

func strPtr(s string) *string { return &s }

func TestTokenIpListInsertRoundTrip(t *testing.T) {
	setupTokenTestDB(t)

	tok := &Token{
		UserId:   1,
		Key:      "testkey123",
		Name:     "test",
		AllowIps: strPtr("1.2.3.4\n10.0.0.0/8"),
		BlockIps: strPtr("5.6.7.8"),
		Group:    "default",
		Status:   1,
	}
	if err := tok.Insert(); err != nil {
		t.Fatalf("insert failed: %v", err)
	}

	got, err := GetTokenByIds(tok.Id, 1)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	if got.AllowIps == nil || *got.AllowIps != "1.2.3.4\n10.0.0.0/8" {
		t.Fatalf("allow_ips not persisted, got: %v", got.AllowIps)
	}
	if got.BlockIps == nil || *got.BlockIps != "5.6.7.8" {
		t.Fatalf("block_ips not persisted, got: %v", got.BlockIps)
	}
}

func TestTokenIpListUpdateRoundTrip(t *testing.T) {
	setupTokenTestDB(t)

	tok := &Token{
		UserId: 1,
		Key:    "testkey456",
		Name:   "test",
		Group:  "default",
		Status: 1,
	}
	if err := tok.Insert(); err != nil {
		t.Fatalf("insert failed: %v", err)
	}

	got, err := GetTokenByIds(tok.Id, 1)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	got.AllowIps = strPtr("9.9.9.9")
	got.BlockIps = strPtr("8.8.8.8")
	if err := got.Update(); err != nil {
		t.Fatalf("update failed: %v", err)
	}

	got2, err := GetTokenByIds(tok.Id, 1)
	if err != nil {
		t.Fatalf("get2 failed: %v", err)
	}
	if got2.AllowIps == nil || *got2.AllowIps != "9.9.9.9" {
		t.Fatalf("allow_ips not updated, got: %v", got2.AllowIps)
	}
	if got2.BlockIps == nil || *got2.BlockIps != "8.8.8.8" {
		t.Fatalf("block_ips not updated, got: %v", got2.BlockIps)
	}

	// clear them again (empty string pointer)
	got2.AllowIps = strPtr("")
	got2.BlockIps = strPtr("")
	if err := got2.Update(); err != nil {
		t.Fatalf("update2 failed: %v", err)
	}
	got3, err := GetTokenByIds(tok.Id, 1)
	if err != nil {
		t.Fatalf("get3 failed: %v", err)
	}
	if got3.AllowIps == nil || *got3.AllowIps != "" {
		t.Fatalf("allow_ips not cleared, got: %v", got3.AllowIps)
	}
	if got3.BlockIps == nil || *got3.BlockIps != "" {
		t.Fatalf("block_ips not cleared, got: %v", got3.BlockIps)
	}
}
