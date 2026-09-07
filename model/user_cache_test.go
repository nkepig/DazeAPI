package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestUserBaseCacheLooksComplete(t *testing.T) {
	if userBaseCacheLooksComplete(7, nil) {
		t.Fatal("nil cache must be incomplete")
	}
	if userBaseCacheLooksComplete(7, &UserBase{Quota: -1000}) {
		t.Fatal("HINCRBY-only hash (Id=0, Status=0) must be incomplete")
	}
	if userBaseCacheLooksComplete(7, &UserBase{Id: 7, Quota: 100, Status: 0}) {
		t.Fatal("missing Status must be incomplete")
	}
	if !userBaseCacheLooksComplete(7, &UserBase{Id: 7, Quota: 100, Status: common.UserStatusEnabled}) {
		t.Fatal("enabled user hash must be complete")
	}
	if userBaseCacheLooksComplete(7, &UserBase{Id: 8, Quota: 100, Status: common.UserStatusEnabled}) {
		t.Fatal("Id mismatch must be incomplete")
	}
}
