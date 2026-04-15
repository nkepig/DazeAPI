package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	SecureVerificationSessionKey = "secure_verified_at"
	SecureVerificationTimeout = 300
)

type UniversalVerifyRequest struct {
	Method string `json:"method"`
	Code   string `json:"code,omitempty"`
}

type VerificationStatusResponse struct {
	Verified  bool  `json:"verified"`
	ExpiresAt int64 `json:"expires_at,omitempty"`
}

func UniversalVerify(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "未登录",
		})
		return
	}

	var req UniversalVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, fmt.Errorf("参数错误: %v", err))
		return
	}

	user := &model.User{Id: userId}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, fmt.Errorf("获取用户信息失败: %v", err))
		return
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiError(c, fmt.Errorf("该用户已被禁用"))
		return
	}

	now, err := setSecureVerificationSession(c)
	if err != nil {
		common.ApiError(c, fmt.Errorf("保存验证状态失败: %v", err))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "验证成功",
		"data": gin.H{
			"verified":   true,
			"expires_at": now + SecureVerificationTimeout,
		},
	})
}

func setSecureVerificationSession(c *gin.Context) (int64, error) {
	session := sessions.Default(c)
	now := time.Now().Unix()
	session.Set(SecureVerificationSessionKey, now)
	if err := session.Save(); err != nil {
		return 0, err
	}
	return now, nil
}