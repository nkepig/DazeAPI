package model

import "strings"

// NormalizeGroupField 规范化分组字段：仅 trim；未填写对应空字符串 ""（与 abilities 中空分组一致）。
func NormalizeGroupField(s string) string {
	return strings.TrimSpace(s)
}
