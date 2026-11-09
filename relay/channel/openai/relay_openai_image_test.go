package openai

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

func TestImageRequestPreservesStream(t *testing.T) {
	var request dto.ImageRequest
	if err := json.Unmarshal([]byte(`{"model":"gpt-image-2.6-flare","prompt":"boat","stream":true,"partial_images":1}`), &request); err != nil {
		t.Fatal(err)
	}
	if !request.IsStream(nil) {
		t.Fatal("stream flag was not preserved")
	}
	body, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"stream":true`) {
		t.Fatalf("marshaled request does not contain stream flag: %s", body)
	}
}

func TestOpenaiHandlerWithUsagePassesThroughImageSSE(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const eventStream = "event: image_generation.completed\ndata: {\"created_at\":1793873414,\"type\":\"image_generation.completed\",\"b64_json\":\"abc\",\"usage\":{\"input_tokens\":19,\"input_tokens_details\":{\"image_tokens\":0,\"text_tokens\":19},\"output_tokens\":824,\"output_tokens_details\":{\"image_tokens\":824,\"text_tokens\":0},\"total_tokens\":843}}\n\n"
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	response := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(eventStream)),
	}

	usage, apiErr := OpenaiHandlerWithUsage(ctx, nil, response)
	if apiErr != nil {
		t.Fatalf("handler error: %v", apiErr)
	}
	if usage == nil {
		t.Fatal("expected usage object")
	}
	if usage.PromptTokens != 19 || usage.CompletionTokens != 824 || usage.TotalTokens != 843 {
		t.Fatalf("usage tokens=(%d, %d, %d), want (19, 824, 843)", usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
	}
	if usage.PromptTokensDetails.TextTokens != 19 || usage.CompletionTokenDetails.ImageTokens != 824 {
		t.Fatalf("usage details input text=%d output image=%d, want 19 and 824", usage.PromptTokensDetails.TextTokens, usage.CompletionTokenDetails.ImageTokens)
	}
	if got := recorder.Body.String(); got != eventStream {
		t.Fatalf("stream body mismatch\n got: %q\nwant: %q", got, eventStream)
	}
	if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/event-stream") {
		t.Fatalf("Content-Type=%q, want text/event-stream", got)
	}
}
