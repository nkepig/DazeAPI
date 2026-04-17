package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/setting/pricing"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    pricing.GetModelPricingMap(),
	})
}
