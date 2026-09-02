package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

func cacheSetToken(token Token) error {
	key := common.GenerateHMAC(token.Key)
	token.Clean()
	err := common.RedisHSetObj(fmt.Sprintf("token:%s", key), &token, time.Duration(common.RedisKeyCacheSeconds())*time.Second)
	if err != nil {
		return err
	}
	return nil
}

func cacheDeleteToken(key string) error {
	key = common.GenerateHMAC(key)
	err := common.RedisDelKey(fmt.Sprintf("token:%s", key))
	if err != nil {
		return err
	}
	return nil
}

func cacheIncrTokenQuota(key string, increment int64) error {
	hmacKey := common.GenerateHMAC(key)
	redisKey := fmt.Sprintf("token:%s", hmacKey)
	ok, err := common.RedisHIncrByIfComplete(redisKey, constant.TokenFiledRemainQuota, increment)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	// Missing/incomplete hash: do not HINCRBY from zero (that would lock a bogus
	// RemainQuota until TTL). Skip and let the next DB read rebuild the cache.
	return nil
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

// tokenCacheLooksComplete rejects partial Redis hashes (e.g. only RemainQuota from HINCRBY on an expired key)
func tokenCacheLooksComplete(t *Token) bool {
	return t != nil && t.Id != 0 &&
		(t.Status == common.TokenStatusEnabled ||
			t.Status == common.TokenStatusDisabled ||
			t.Status == common.TokenStatusExhausted)
}

// CacheGetTokenByKey 从缓存中获取 token，如果缓存中不存在，则从数据库中获取
func cacheGetTokenByKey(key string) (*Token, error) {
	hmacKey := common.GenerateHMAC(key)
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var token Token
	err := common.RedisHGetObj(fmt.Sprintf("token:%s", hmacKey), &token)
	if err != nil {
		return nil, err
	}
	token.Key = key
	if !tokenCacheLooksComplete(&token) {
		// Partial hash (e.g. created by HINCRBY on expired key); invalidate and fall back to DB
		_ = common.RedisDelKey(fmt.Sprintf("token:%s", hmacKey))
		return nil, fmt.Errorf("token cache incomplete for key hash %s", hmacKey[:8])
	}
	return &token, nil
}
