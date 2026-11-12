package service

import (
	"github.com/QuantumNous/new-api/dto"
)

// ContextKeyStreamFailureEstimatedUsage 标记 usage 是上游流异常结束（failed/EOF/超时等）且缺 usage 时，
// 由网关按已输出内容估算得出的，结算时会在日志里注明。
const ContextKeyStreamFailureEstimatedUsage = "stream_failure_estimated_usage"

func ValidUsage(usage *dto.Usage) bool {
	if usage == nil {
		return false
	}
	usage.EnsureChatTokenFields()
	return usage.PromptTokens != 0 || usage.CompletionTokens != 0
}
