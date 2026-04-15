package model

import "errors"

// CustomOAuthProvider is a stub; the custom OAuth feature has been removed.
type CustomOAuthProvider struct {
	Id                  int    `gorm:"primaryKey;autoIncrement"`
	Name                string `gorm:"type:varchar(255)"`
	Slug                string `gorm:"type:varchar(128);uniqueIndex"`
	Enabled             bool
	ClientId            string `gorm:"type:varchar(512)"`
	ClientSecret        string `gorm:"type:varchar(512)"`
	AuthStyle           int
	TokenEndpoint       string `gorm:"type:text"`
	UserInfoEndpoint    string `gorm:"type:text"`
	UserIdField         string `gorm:"type:varchar(255)"`
	UsernameField       string `gorm:"type:varchar(255)"`
	DisplayNameField    string `gorm:"type:varchar(255)"`
	EmailField          string `gorm:"type:varchar(255)"`
	AccessPolicy        string `gorm:"type:text"`
	AccessDeniedMessage    string `gorm:"type:text"`
	Icon                   string `gorm:"type:varchar(512)"`
	AuthorizationEndpoint  string `gorm:"type:text"`
	Scopes                 string `gorm:"type:text"`
}

// GetAllCustomOAuthProviders returns an empty list; custom OAuth is disabled.
func GetAllCustomOAuthProviders() ([]*CustomOAuthProvider, error) {
	return nil, nil
}

// IsProviderUserIdTaken always returns false; custom OAuth is disabled.
func IsProviderUserIdTaken(providerId int, providerUserId string) bool {
	return false
}

// GetUserByOAuthBinding always returns not-found; custom OAuth is disabled.
func GetUserByOAuthBinding(providerId int, providerUserId string) (*User, error) {
	return nil, errors.New("custom OAuth is disabled")
}
