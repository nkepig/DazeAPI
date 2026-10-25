package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestResponsesStreamHandlersPreserveUpstreamUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, handler := range []struct {
		name string
		run  func(*gin.Context, *relaycommon.RelayInfo, *http.Response) (*dto.Usage, *types.NewAPIError)
	}{
		{name: "responses", run: OaiResponsesStreamHandler},
		{name: "responses to chat", run: OaiResponsesToChatStreamHandler},
	} {
		for _, outputTokens := range []int{0, 1} {
			t.Run(fmt.Sprintf("%s/output_%d", handler.name, outputTokens), func(t *testing.T) {
				totalTokens := 4406 + outputTokens
				usageJSON := fmt.Sprintf(`{"input_tokens":4406,"output_tokens":%d,"total_tokens":%d,"input_tokens_details":{"cached_tokens":3500},"vendor_extra":{"region":"test"}}`, outputTokens, totalTokens)
				event := fmt.Sprintf("data: {\"type\":\"response.in_progress\",\"response\":{\"usage\":%s}}\n\n", usageJSON)
				context, _ := gin.CreateTestContext(httptest.NewRecorder())
				context.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
				info := &relaycommon.RelayInfo{
					ChannelMeta:        &relaycommon.ChannelMeta{},
					RelayFormat:        types.RelayFormatOpenAI,
					ShouldIncludeUsage: true,
					DisablePing:        true,
				}
				response := &http.Response{Body: io.NopCloser(strings.NewReader(event))}
				usage, apiErr := handler.run(context, info, response)
				if apiErr != nil {
					t.Fatalf("handler error: %v", apiErr)
				}
				if usage == nil || usage.PromptTokens != 4406 || usage.CompletionTokens != outputTokens {
					t.Fatalf("usage=%+v, want prompt=4406 completion=%d", usage, outputTokens)
				}
				if string(usage.OriginalUsageJSON) != usageJSON {
					t.Fatalf("OriginalUsageJSON=%s want %s", usage.OriginalUsageJSON, usageJSON)
				}
				other := map[string]interface{}{}
				service.AttachUsageDict(other, usage)
				stored, ok := other["usage"].(map[string]interface{})
				if !ok || stored["input_tokens"] != float64(4406) || stored["output_tokens"] != float64(outputTokens) {
					t.Fatalf("stored raw usage=%v", stored)
				}
				if _, ok := stored["prompt_tokens"]; ok {
					t.Fatalf("stored usage contains converted prompt_tokens: %v", stored)
				}
			})
		}
	}
}

func TestCaptureOpenAIResponsesStreamUsage(t *testing.T) {
	tests := []struct {
		name           string
		outputTokens   int
		totalTokens    int
		wantCompletion int
	}{
		{name: "zero output", outputTokens: 0, totalTokens: 4406, wantCompletion: 0},
		{name: "one output", outputTokens: 1, totalTokens: 4407, wantCompletion: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			usage := &dto.Usage{}
			data := fmt.Sprintf(`{"type":"response.in_progress","response":{"usage":{"input_tokens":4406,"output_tokens":%d,"total_tokens":%d}}}`, test.outputTokens, test.totalTokens)
			if !captureOpenAIResponsesStreamUsage(usage, data) {
				t.Fatal("usage event was not captured")
			}
			if usage.PromptTokens != 4406 || usage.CompletionTokens != test.wantCompletion {
				t.Fatalf("tokens=%d/%d want 4406/%d", usage.PromptTokens, usage.CompletionTokens, test.wantCompletion)
			}
			wantRaw := fmt.Sprintf(`{"input_tokens":4406,"output_tokens":%d,"total_tokens":%d}`, test.outputTokens, test.totalTokens)
			if string(usage.OriginalUsageJSON) != wantRaw {
				t.Fatalf("OriginalUsageJSON=%s want %s", usage.OriginalUsageJSON, wantRaw)
			}
		})
	}
}

func TestApplyOpenAIResponsesUsageCopiesCacheWriteTokens(t *testing.T) {
	src := &dto.Usage{
		InputTokens:  89907,
		OutputTokens: 1413,
		TotalTokens:  91320,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:     81243,
			CacheWriteTokens: 8661,
		},
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)

	if dst.PromptTokens != 89907 {
		t.Fatalf("PromptTokens=%d want 89907", dst.PromptTokens)
	}
	if dst.PromptTokensDetails.CachedTokens != 81243 {
		t.Fatalf("CachedTokens=%d want 81243", dst.PromptTokensDetails.CachedTokens)
	}
	if dst.PromptTokensDetails.CachedCreationTokens != 8661 {
		t.Fatalf("CachedCreationTokens=%d want 8661", dst.PromptTokensDetails.CachedCreationTokens)
	}
	if dst.PromptTokensDetails.CacheWriteTokens != 8661 {
		t.Fatalf("CacheWriteTokens=%d want 8661", dst.PromptTokensDetails.CacheWriteTokens)
	}
}

func TestApplyOpenAIResponsesUsageCopiesNonCachePromptDetails(t *testing.T) {
	src := &dto.Usage{
		InputTokens:  120,
		OutputTokens: 10,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens:  80,
			AudioTokens: 25,
			ImageTokens: 15,
		},
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)

	if dst.PromptTokensDetails.TextTokens != 80 {
		t.Fatalf("TextTokens=%d want 80", dst.PromptTokensDetails.TextTokens)
	}
	if dst.PromptTokensDetails.AudioTokens != 25 {
		t.Fatalf("AudioTokens=%d want 25", dst.PromptTokensDetails.AudioTokens)
	}
	if dst.PromptTokensDetails.ImageTokens != 15 {
		t.Fatalf("ImageTokens=%d want 15", dst.PromptTokensDetails.ImageTokens)
	}
}

func TestApplyOpenAIResponsesUsageCopiesPromptCompletionTokens(t *testing.T) {
	src := &dto.Usage{
		PromptTokens:     683,
		CompletionTokens: 17,
		TotalTokens:      700,
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)
	if dst.PromptTokens != 683 {
		t.Fatalf("PromptTokens=%d want 683", dst.PromptTokens)
	}
	if dst.CompletionTokens != 17 {
		t.Fatalf("CompletionTokens=%d want 17", dst.CompletionTokens)
	}
}

func TestApplyOpenAIResponsesUsagePreservesOriginalUsageJSON(t *testing.T) {
	src := &dto.Usage{
		InputTokens:       4406,
		OutputTokens:      0,
		OriginalUsageJSON: []byte(`{"input_tokens":4406,"output_tokens":0,"total_tokens":4406}`),
	}
	dst := &dto.Usage{}
	applyOpenAIResponsesUsage(dst, src)
	if string(dst.OriginalUsageJSON) != string(src.OriginalUsageJSON) {
		t.Fatalf("OriginalUsageJSON=%s want %s", dst.OriginalUsageJSON, src.OriginalUsageJSON)
	}
	if dst.PromptTokens != 4406 || dst.CompletionTokens != 0 {
		t.Fatalf("tokens=%d/%d want 4406/0", dst.PromptTokens, dst.CompletionTokens)
	}
}
