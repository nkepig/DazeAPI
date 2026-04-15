package model

import "gorm.io/gorm"

// UserOAuthBinding is a stub; custom OAuth binding has been removed.
type UserOAuthBinding struct {
	Id             int `gorm:"primaryKey;autoIncrement"`
	UserId         int
	ProviderId     int
	ProviderUserId string `gorm:"type:varchar(512)"`
}

// UpdateUserOAuthBinding is a no-op stub; custom OAuth is disabled.
func UpdateUserOAuthBinding(userId int, providerId int, providerUserId string) error {
	return nil
}

// CreateUserOAuthBindingWithTx is a no-op stub; custom OAuth is disabled.
func CreateUserOAuthBindingWithTx(tx *gorm.DB, binding *UserOAuthBinding) error {
	return nil
}
