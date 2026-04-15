package model

import "errors"

// ErrRedeemFailed is returned when redemption fails.
var ErrRedeemFailed = errors.New("redemption feature has been removed")

// Redeem is a no-op stub; the redemption feature has been removed.
func Redeem(key string, userId int) (quota int, err error) {
	return 0, ErrRedeemFailed
}
