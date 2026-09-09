package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// abortWithOpenAiMessage writes an OpenAI-format error and aborts the request.
// message must be English. Do not localize client-facing API errors.
// Official upstream error text should be forwarded as-is, not rewritten here.
func abortWithOpenAiMessage(c *gin.Context, statusCode int, message string, code ...types.ErrorCode) {
	codeStr := ""
	if len(code) > 0 {
		codeStr = string(code[0])
	}
	c.JSON(statusCode, gin.H{
		"error": gin.H{
			"message": common.MessageWithRequestId(message, c.GetString(common.RequestIdKey)),
			"type":    "error",
			"code":    codeStr,
		},
	})
	c.Abort()
}
