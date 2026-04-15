package model

// PasskeyCredential is a stub; the passkey feature has been removed.
type PasskeyCredential struct {
	Id     int `gorm:"primaryKey;autoIncrement"`
	UserId int
}

// GetPasskeyByUserID always returns nil; passkey is disabled.
func GetPasskeyByUserID(userId int) (*PasskeyCredential, error) {
	return nil, nil
}
