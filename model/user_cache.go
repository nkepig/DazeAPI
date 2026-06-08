package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// UserBase struct remains the same as it represents the cached data structure
type UserBase struct {
	Id         int    `json:"id"`
	Group      string `json:"group"`
	GroupRatio string `json:"group_ratio"`
	Email      string `json:"email"`
	Quota      int    `json:"quota"`
	Status     int    `json:"status"`
	Username   string `json:"username"`
	Setting    string `json:"setting"`
}

func (user *UserBase) WriteContext(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyUserGroup, user.Group)
	common.SetContextKey(c, constant.ContextKeyUserGroupRatio, user.GetGroupRatioMap())
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserStatus, user.Status)
	common.SetContextKey(c, constant.ContextKeyUserEmail, user.Email)
	common.SetContextKey(c, constant.ContextKeyUserName, user.Username)
	common.SetContextKey(c, constant.ContextKeyUserSetting, user.GetSetting())
}

func (user *UserBase) GetSetting() dto.UserSetting {
	setting := dto.UserSetting{}
	if user.Setting != "" {
		err := common.Unmarshal([]byte(user.Setting), &setting)
		if err != nil {
			common.SysLog("failed to unmarshal setting: " + err.Error())
		}
	}
	return setting
}

func (user *UserBase) GetGroupRatioMap() map[string]float64 {
	result := make(map[string]float64)
	if user.GroupRatio == "" {
		return operation_setting.DefaultRegistrationGroupRatioCopy()
	}
	err := common.Unmarshal([]byte(user.GroupRatio), &result)
	if err != nil {
		common.SysLog("failed to unmarshal group_ratio for user " + user.Username + ": " + err.Error())
	}
	if len(result) == 0 {
		return operation_setting.DefaultRegistrationGroupRatioCopy()
	}
	// Merge: defaults fill gaps; user values take precedence.
	defaults := operation_setting.DefaultRegistrationGroupRatioCopy()
	for group, ratio := range defaults {
		if _, exists := result[group]; !exists {
			result[group] = ratio
		}
	}
	return result
}

// getUserCacheKey returns the key for user cache
func getUserCacheKey(userId int) string {
	return fmt.Sprintf("user:%d", userId)
}

// invalidateUserCache clears user cache
func invalidateUserCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisDelKey(getUserCacheKey(userId))
}

// updateUserCache updates all user cache fields using a Lua script that
// preserves the Quota field if it already exists (managed by HINCRBY).
func updateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}

	return common.RedisHSetObjPreservingFields(
		getUserCacheKey(user.Id),
		user.ToBaseUser(),
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
		map[string]bool{"Quota": true},
	)
}

// userBaseCacheLooksComplete rejects partial Redis hashes (e.g. only Quota from HINCRBY)
func userBaseCacheLooksComplete(userId int, ub *UserBase) bool {
	return ub != nil && ub.Id == userId &&
		(ub.Status == common.UserStatusEnabled || ub.Status == common.UserStatusDisabled)
}

// GetUserCache gets complete user cache from hash
func GetUserCache(userId int) (userCache *UserBase, err error) {
	var user *User
	var fromDB bool
	defer func() {
		if shouldUpdateRedis(fromDB, err) && user != nil {
			if err := updateUserCache(*user); err != nil {
				common.SysLog("failed to update user status cache: " + err.Error())
			}
		}
	}()

	userCache, err = cacheGetUserBase(userId)
	if err == nil && userBaseCacheLooksComplete(userId, userCache) {
		return userCache, nil
	}
	if err == nil {
		_ = invalidateUserCache(userId)
	}

	// Redis miss / incomplete / error: load from DB and refresh cache in defer
	fromDB = true
	user, err = GetUserById(userId, false)
	if err != nil {
		return nil, err // Return nil and error if DB lookup fails
	}

	// Create cache object from user data
	userCache = &UserBase{
		Id:         user.Id,
		Group:      user.Group,
		GroupRatio: user.GroupRatio,
		Quota:      user.Quota,
		Status:     user.Status,
		Username:   user.Username,
		Setting:    user.Setting,
		Email:      user.Email,
	}

	return userCache, nil
}

func cacheGetUserBase(userId int) (*UserBase, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var userCache UserBase
	// Try getting from Redis first
	err := common.RedisHGetObj(getUserCacheKey(userId), &userCache)
	if err != nil {
		return nil, err
	}
	return &userCache, nil
}

// Add atomic quota operations using hash fields
func cacheIncrUserQuota(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHIncrBy(getUserCacheKey(userId), "Quota", delta)
}

func cacheDecrUserQuota(userId int, delta int64) error {
	return cacheIncrUserQuota(userId, -delta)
}

// syncUserQuotaCacheIncr mirrors a DB quota credit in Redis (e.g. after topup).
func syncUserQuotaCacheIncr(userId int, delta int64) {
	if delta == 0 || !common.RedisEnabled {
		return
	}
	if err := cacheIncrUserQuota(userId, delta); err != nil {
		common.SysLog(fmt.Sprintf("failed to sync user %d quota cache (delta=%d): %s", userId, delta, err.Error()))
	}
}

// Helper functions to get individual fields if needed
func getUserGroupCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Group, nil
}

func getUserQuotaCache(userId int) (int, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return 0, err
	}
	return cache.Quota, nil
}

func getUserStatusCache(userId int) (int, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return 0, err
	}
	return cache.Status, nil
}

func getUserNameCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Username, nil
}

func getUserSettingCache(userId int) (dto.UserSetting, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return dto.UserSetting{}, err
	}
	return cache.GetSetting(), nil
}

// New functions for individual field updates
func updateUserStatusCache(userId int, status bool) error {
	if !common.RedisEnabled {
		return nil
	}
	statusInt := common.UserStatusEnabled
	if !status {
		statusInt = common.UserStatusDisabled
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Status", fmt.Sprintf("%d", statusInt))
}

func updateUserQuotaCache(userId int, quota int) error {
	if !common.RedisEnabled {
		return nil
	}
	// HSETNX: never overwrite Quota — it's managed by HINCRBY.
	_, err := common.RedisHSetNXField(getUserCacheKey(userId), "Quota", fmt.Sprintf("%d", quota))
	return err
}

func updateUserGroupCache(userId int, group string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Group", group)
}

func UpdateUserGroupCache(userId int, group string) error {
	return updateUserGroupCache(userId, group)
}

func updateUserNameCache(userId int, username string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Username", username)
}

func updateUserSettingCache(userId int, setting string) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHSetField(getUserCacheKey(userId), "Setting", setting)
}

// GetUserLanguage returns the user's language preference from cache
// Uses the existing GetUserCache mechanism for efficiency
func GetUserLanguage(userId int) string {
	userCache, err := GetUserCache(userId)
	if err != nil {
		return ""
	}
	return userCache.GetSetting().Language
}
