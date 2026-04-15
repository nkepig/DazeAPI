package model

// TwoFA is a stub; the two-factor authentication feature has been removed.
type TwoFA struct {
	Id     int `gorm:"primaryKey;autoIncrement"`
	UserId int
}

// ValidateTOTPAndUpdateUsage always returns (false, nil); 2FA is disabled.
func (t *TwoFA) ValidateTOTPAndUpdateUsage(code string) (bool, error) {
	return false, nil
}

// ValidateBackupCodeAndUpdateUsage always returns (false, nil); 2FA is disabled.
func (t *TwoFA) ValidateBackupCodeAndUpdateUsage(code string) (bool, error) {
	return false, nil
}

// IsEnabled always returns false; 2FA is disabled.
func (t *TwoFA) IsEnabled() bool {
	return false
}

// GetTwoFAByUserId always returns nil; 2FA is disabled.
func GetTwoFAByUserId(userId int) (*TwoFA, error) {
	return nil, nil
}
