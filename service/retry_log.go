package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

const ContextKeyRetryAttempts = "retry_attempts"

type RetryAttemptLog struct {
	RetryIndex     int    `json:"retry_index"`
	ChannelId      int    `json:"channel_id"`
	ChannelName    string `json:"channel_name,omitempty"`
	IsMultiKey     bool   `json:"is_multi_key,omitempty"`
	MultiKeyIndex  *int   `json:"multi_key_index,omitempty"`
	StatusCode     int    `json:"status_code"`
	Success        bool   `json:"success"`
	Error          string `json:"error,omitempty"`
	UseTimeSeconds int    `json:"use_time_seconds,omitempty"`
}

func AppendRetryAttempt(c *gin.Context, attempt RetryAttemptLog) {
	if c == nil {
		return
	}
	attempts := GetRetryAttempts(c)
	attempts = append(attempts, attempt)
	c.Set(ContextKeyRetryAttempts, attempts)
}

func GetRetryAttempts(c *gin.Context) []RetryAttemptLog {
	if c == nil {
		return nil
	}
	raw, ok := c.Get(ContextKeyRetryAttempts)
	if !ok || raw == nil {
		return nil
	}
	attempts, ok := raw.([]RetryAttemptLog)
	if !ok {
		return nil
	}
	return attempts
}

func BuildLogAdminInfo(ctx *gin.Context) map[string]interface{} {
	if ctx == nil {
		return map[string]interface{}{}
	}

	adminInfo := make(map[string]interface{})
	useChannel := ctx.GetStringSlice("use_channel")
	if useChannel == nil {
		useChannel = []string{}
	}
	adminInfo["use_channel"] = useChannel

	isMultiKey := common.GetContextKeyBool(ctx, constant.ContextKeyChannelIsMultiKey)
	if isMultiKey {
		adminInfo["is_multi_key"] = true
		adminInfo["multi_key_index"] = common.GetContextKeyInt(ctx, constant.ContextKeyChannelMultiKeyIndex)
	}

	isLocalCountTokens := common.GetContextKeyBool(ctx, constant.ContextKeyLocalCountTokens)
	if isLocalCountTokens {
		adminInfo["local_count_tokens"] = true
	}

	if attempts := GetRetryAttempts(ctx); len(attempts) > 0 {
		adminInfo["retry_attempts"] = attempts
	}

	AppendChannelAffinityAdminInfo(ctx, adminInfo)
	return adminInfo
}
