package openai

import (
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func applyOpenAIResponsesUsage(dst *dto.Usage, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	if src.InputTokens != 0 {
		dst.PromptTokens = src.InputTokens
	} else if src.PromptTokens != 0 {
		dst.PromptTokens = src.PromptTokens
	}
	if src.OutputTokens != 0 {
		dst.CompletionTokens = src.OutputTokens
	} else if src.CompletionTokens != 0 {
		dst.CompletionTokens = src.CompletionTokens
	}
	if src.TotalTokens != 0 {
		dst.TotalTokens = src.TotalTokens
	}
	if src.InputTokensDetails != nil {
		dst.PromptTokensDetails.CachedTokens = src.InputTokensDetails.CachedTokens
	}
}

func OaiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = common.Unmarshal(responseBody, &responsesResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := responsesResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	if responsesResponse.HasImageGenerationCall() {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_quality", responsesResponse.GetQuality())
		c.Set("image_generation_call_size", responsesResponse.GetSize())
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	usage := dto.Usage{}
	if responsesResponse.Usage != nil {
		applyOpenAIResponsesUsage(&usage, responsesResponse.Usage)
	}
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return &usage, nil
	}
	// 解析 Tools 用量
	for _, tool := range responsesResponse.Tools {
		buildToolinfo, ok := info.ResponsesUsageInfo.BuiltInTools[common.Interface2String(tool["type"])]
		if !ok || buildToolinfo == nil {
			logger.LogError(c, fmt.Sprintf("BuiltInTools not found for tool type: %v", tool["type"]))
			continue
		}
		buildToolinfo.CallCount++
	}
	return &usage, nil
}

func OaiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var usage = &dto.Usage{}

	helper.StreamScannerHandler(c, resp, info, func(data string) bool {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err == nil {
			sendResponsesStreamData(c, streamResponse, data)
			switch streamResponse.Type {
			case "response.completed", "response.incomplete":
				if streamResponse.Response != nil {
					if streamResponse.Response.Usage != nil {
						applyOpenAIResponsesUsage(usage, streamResponse.Response.Usage)
					}
					if streamResponse.Response.HasImageGenerationCall() {
						c.Set("image_generation_call", true)
						c.Set("image_generation_call_quality", streamResponse.Response.GetQuality())
						c.Set("image_generation_call_size", streamResponse.Response.GetSize())
					}
				}
			case dto.ResponsesOutputTypeItemDone:
				// 函数调用处理
				if streamResponse.Item != nil {
					switch streamResponse.Item.Type {
					case dto.BuildInCallWebSearchCall:
						if info != nil && info.ResponsesUsageInfo != nil && info.ResponsesUsageInfo.BuiltInTools != nil {
							if webSearchTool, exists := info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview]; exists && webSearchTool != nil {
								webSearchTool.CallCount++
							}
						}
					}
				}
			}
		} else {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
		}
		return true
	})

	return usage, nil
}
