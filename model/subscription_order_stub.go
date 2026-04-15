package model

import "errors"

// ErrSubscriptionOrderNotFound is returned when a subscription order is not found.
var ErrSubscriptionOrderNotFound = errors.New("subscription order not found")

// CompleteSubscriptionOrder is a no-op stub; subscription feature has been removed.
func CompleteSubscriptionOrder(orderId string, paymentIntentId string) error {
	return ErrSubscriptionOrderNotFound
}

// ExpireSubscriptionOrder is a no-op stub; subscription feature has been removed.
func ExpireSubscriptionOrder(orderId string) error {
	return ErrSubscriptionOrderNotFound
}
