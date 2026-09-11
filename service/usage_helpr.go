package service

import (
	"github.com/QuantumNous/new-api/dto"
)

func ValidUsage(usage *dto.Usage) bool {
	if usage == nil {
		return false
	}
	usage.EnsureChatTokenFields()
	return usage.PromptTokens != 0 || usage.CompletionTokens != 0
}
