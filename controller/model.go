package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type openAIModelObject struct {
	Id      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

func buildModelList(modelNames []string) []openAIModelObject {
	result := make([]openAIModelObject, 0, len(modelNames))
	for _, name := range modelNames {
		result = append(result, openAIModelObject{
			Id:      name,
			Object:  "model",
			Created: 1677610602,
			OwnedBy: "openai",
		})
	}
	return result
}

// ListModels returns available models for the given channel type.
func ListModels(c *gin.Context, channelType int) {
	models := buildModelList(model.GetEnabledModels())
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}

// RetrieveModel retrieves a specific model's information.
func RetrieveModel(c *gin.Context, channelType int) {
	modelId := c.Param("model")
	models := model.GetEnabledModels()
	for _, name := range models {
		if name == modelId {
			c.JSON(http.StatusOK, openAIModelObject{
				Id:      name,
				Object:  "model",
				Created: 1677610602,
				OwnedBy: "openai",
			})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": gin.H{
			"message": "The model '" + modelId + "' does not exist",
			"type":    "invalid_request_error",
			"code":    "model_not_found",
		},
	})
}

// DashboardListModels returns all available models for dashboard view.
func DashboardListModels(c *gin.Context) {
	models := buildModelList(model.GetEnabledModels())
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}

// ChannelListModels returns models available for the specified channel.
func ChannelListModels(c *gin.Context) {
	models := buildModelList(model.GetEnabledModels())
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}

// EnabledListModels returns only enabled models.
func EnabledListModels(c *gin.Context) {
	models := buildModelList(model.GetEnabledModels())
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   models,
	})
}
