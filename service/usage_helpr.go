package service

import (
	"github.com/QuantumNous/new-api/dto"
)

func ValidUsage(usage *dto.Usage) bool {
	return usage != nil && (usage.PromptTokens != 0 || usage.CompletionTokens != 0)
}
