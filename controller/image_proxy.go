package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ImageProxy(c *gin.Context) {
	hash := c.Param("hash")
	if hash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hash is required"})
		return
	}
	service.ServeImageProxy(c.Writer, hash)
}
