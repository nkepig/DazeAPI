package service

import (
	"net/http"

	"github.com/gin-gonic/gin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func WriteResponseWithConvert(c *gin.Context, src *http.Response, data []byte, info *relaycommon.RelayInfo) {
	if info.ChannelSetting.ConvertImageBase64ToURL || info.ChannelSetting.ConvertImageURLToBase64 {
		baseURL := GetRequestBaseURL(c)
		if info.ChannelSetting.ConvertImageBase64ToURL {
			data = TransformResponseImages(data, ConvertBase64ToURL, baseURL)
		}
		if info.ChannelSetting.ConvertImageURLToBase64 {
			data = TransformResponseImages(data, ConvertURLToBase64, baseURL)
		}
	}
	IOCopyBytesGracefully(c, src, data)
}
