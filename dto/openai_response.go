package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/types"
)

const (
	ResponsesOutputTypeImageGenerationCall = "image_generation_call"
)

type SimpleResponse struct {
	Usage `json:"usage"`
	Error any `json:"error"`
}

// GetOpenAIError 从动态错误类型中提取OpenAIError结构
func (s *SimpleResponse) GetOpenAIError() *types.OpenAIError {
	return GetOpenAIError(s.Error)
}

type TextResponse struct {
	Id      string                     `json:"id"`
	Object  string                     `json:"object"`
	Created int64                      `json:"created"`
	Model   string                     `json:"model"`
	Choices []OpenAITextResponseChoice `json:"choices"`
	Usage   `json:"usage"`
}

type OpenAITextResponseChoice struct {
	Index        int `json:"index"`
	Message      `json:"message"`
	FinishReason string `json:"finish_reason"`
}

type OpenAITextResponse struct {
	Id      string                     `json:"id"`
	Model   string                     `json:"model"`
	Object  string                     `json:"object"`
	Created any                        `json:"created"`
	Choices []OpenAITextResponseChoice `json:"choices"`
	Error   any                        `json:"error,omitempty"`
	Usage   `json:"usage"`
}

// GetOpenAIError 从动态错误类型中提取OpenAIError结构
func (o *OpenAITextResponse) GetOpenAIError() *types.OpenAIError {
	return GetOpenAIError(o.Error)
}

type OpenAIEmbeddingResponseItem struct {
	Object    string    `json:"object"`
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

type OpenAIEmbeddingResponse struct {
	Object string                        `json:"object"`
	Data   []OpenAIEmbeddingResponseItem `json:"data"`
	Model  string                        `json:"model"`
	Usage  `json:"usage"`
}

type FlexibleEmbeddingResponseItem struct {
	Object    string `json:"object"`
	Index     int    `json:"index"`
	Embedding any    `json:"embedding"`
}

type FlexibleEmbeddingResponse struct {
	Object string                          `json:"object"`
	Data   []FlexibleEmbeddingResponseItem `json:"data"`
	Model  string                          `json:"model"`
	Usage  `json:"usage"`
}

type ChatCompletionsStreamResponseChoice struct {
	Delta        ChatCompletionsStreamResponseChoiceDelta `json:"delta,omitempty"`
	Logprobs     *any                                     `json:"logprobs"`
	FinishReason *string                                  `json:"finish_reason"`
	Index        int                                      `json:"index"`
}

type ChatCompletionsStreamResponseChoiceDelta struct {
	Content          *string            `json:"content,omitempty"`
	ReasoningContent *string            `json:"reasoning_content,omitempty"`
	Reasoning        *string            `json:"reasoning,omitempty"`
	Role             string             `json:"role,omitempty"`
	ToolCalls        []ToolCallResponse `json:"tool_calls,omitempty"`
}

func (c *ChatCompletionsStreamResponseChoiceDelta) SetContentString(s string) {
	c.Content = &s
}

func (c *ChatCompletionsStreamResponseChoiceDelta) GetContentString() string {
	if c.Content == nil {
		return ""
	}
	return *c.Content
}

func (c *ChatCompletionsStreamResponseChoiceDelta) GetReasoningContent() string {
	if c.ReasoningContent == nil && c.Reasoning == nil {
		return ""
	}
	if c.ReasoningContent != nil {
		return *c.ReasoningContent
	}
	return *c.Reasoning
}

func (c *ChatCompletionsStreamResponseChoiceDelta) SetReasoningContent(s string) {
	c.ReasoningContent = &s
	//c.Reasoning = &s
}

type ToolCallResponse struct {
	// Index is not nil only in chat completion chunk object
	Index    *int             `json:"index,omitempty"`
	ID       string           `json:"id,omitempty"`
	Type     any              `json:"type"`
	Function FunctionResponse `json:"function"`
}

func (c *ToolCallResponse) SetIndex(i int) {
	c.Index = &i
}

type FunctionResponse struct {
	Description string `json:"description,omitempty"`
	Name        string `json:"name,omitempty"`
	// call function with arguments in JSON format
	Parameters any    `json:"parameters,omitempty"` // request
	Arguments  string `json:"arguments"`            // response
}

type ChatCompletionsStreamResponse struct {
	Id                string                                `json:"id"`
	Object            string                                `json:"object"`
	Created           int64                                 `json:"created"`
	Model             string                                `json:"model"`
	SystemFingerprint *string                               `json:"system_fingerprint"`
	Choices           []ChatCompletionsStreamResponseChoice `json:"choices"`
	Usage             *Usage                                `json:"usage"`
}

func (c *ChatCompletionsStreamResponse) IsFinished() bool {
	if len(c.Choices) == 0 {
		return false
	}
	return c.Choices[0].FinishReason != nil && *c.Choices[0].FinishReason != ""
}

func (c *ChatCompletionsStreamResponse) IsToolCall() bool {
	if len(c.Choices) == 0 {
		return false
	}
	return len(c.Choices[0].Delta.ToolCalls) > 0
}

func (c *ChatCompletionsStreamResponse) GetFirstToolCall() *ToolCallResponse {
	if c.IsToolCall() {
		return &c.Choices[0].Delta.ToolCalls[0]
	}
	return nil
}

func (c *ChatCompletionsStreamResponse) ClearToolCalls() {
	if !c.IsToolCall() {
		return
	}
	for choiceIdx := range c.Choices {
		for callIdx := range c.Choices[choiceIdx].Delta.ToolCalls {
			c.Choices[choiceIdx].Delta.ToolCalls[callIdx].ID = ""
			c.Choices[choiceIdx].Delta.ToolCalls[callIdx].Type = nil
			c.Choices[choiceIdx].Delta.ToolCalls[callIdx].Function.Name = ""
		}
	}
}

func (c *ChatCompletionsStreamResponse) Copy() *ChatCompletionsStreamResponse {
	choices := make([]ChatCompletionsStreamResponseChoice, len(c.Choices))
	copy(choices, c.Choices)
	return &ChatCompletionsStreamResponse{
		Id:                c.Id,
		Object:            c.Object,
		Created:           c.Created,
		Model:             c.Model,
		SystemFingerprint: c.SystemFingerprint,
		Choices:           choices,
		Usage:             c.Usage,
	}
}

func (c *ChatCompletionsStreamResponse) GetSystemFingerprint() string {
	if c.SystemFingerprint == nil {
		return ""
	}
	return *c.SystemFingerprint
}

func (c *ChatCompletionsStreamResponse) SetSystemFingerprint(s string) {
	c.SystemFingerprint = &s
}

type ChatCompletionsStreamResponseSimple struct {
	Choices []ChatCompletionsStreamResponseChoice `json:"choices"`
	Usage   *Usage                                `json:"usage"`
}

type CompletionsStreamResponse struct {
	Choices []struct {
		Text         string `json:"text"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

type Usage struct {
	PromptTokens         int    `json:"prompt_tokens"`
	CompletionTokens     int    `json:"completion_tokens"`
	TotalTokens          int    `json:"total_tokens"`
	PromptCacheHitTokens int    `json:"prompt_cache_hit_tokens,omitempty"`
	UsageSemantic        string `json:"usage_semantic,omitempty"`
	UsageSource          string `json:"usage_source,omitempty"`

	PromptTokensDetails    InputTokenDetails   `json:"prompt_tokens_details"`
	CompletionTokenDetails OutputTokenDetails  `json:"completion_tokens_details"`
	InputTokens            int                 `json:"input_tokens"`
	OutputTokens           int                 `json:"output_tokens"`
	InputTokensDetails     *InputTokenDetails  `json:"input_tokens_details"`
	OutputTokensDetails    *OutputTokenDetails `json:"output_tokens_details,omitempty"`

	// claude cache 1h
	ClaudeCacheCreation5mTokens int `json:"claude_cache_creation_5_m_tokens"`
	ClaudeCacheCreation1hTokens int `json:"claude_cache_creation_1_h_tokens"`

	// OpenRouter Params
	Cost any `json:"cost,omitempty"`

	// OriginalUsageJSON is the usage object as received from upstream.
	OriginalUsageJSON json.RawMessage `json:"-"`
}

func (u *Usage) UnmarshalJSON(data []byte) error {
	usageJSON := ExtractUsageJSON(data)
	type usageAlias Usage
	var decoded usageAlias
	if err := json.Unmarshal(usageJSON, &decoded); err != nil {
		return err
	}
	*u = Usage(decoded)
	u.OriginalUsageJSON = append(json.RawMessage(nil), usageJSON...)
	u.EnsureChatTokenFields()
	u.NormalizeInputTokenDetails()
	u.NormalizeOutputTokenDetails()
	return nil
}

// ParseModelUsage reads the usage object from an original model response.
// Chat Completions use the top-level usage (prompt_tokens / completion_tokens).
// Responses events and response objects use response.usage or usage
// (input_tokens / output_tokens). Converted copies are not consulted.
func ParseModelUsage(data []byte) (*Usage, string) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return nil, ""
	}
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &envelope); err != nil {
		return nil, ""
	}
	object := jsonText(envelope["object"])
	eventType := jsonText(envelope["type"])

	kind := ""
	var usageRaw json.RawMessage
	switch {
	case strings.HasPrefix(eventType, "response.") || object == "response":
		kind = "responses"
		if respRaw := bytes.TrimSpace(envelope["response"]); len(respRaw) > 0 && respRaw[0] == '{' {
			var response map[string]json.RawMessage
			if err := json.Unmarshal(respRaw, &response); err == nil {
				usageRaw = response["usage"]
			}
		}
		if !jsonObject(usageRaw) {
			usageRaw = envelope["usage"]
		}
	case object == "chat.completion" || object == "chat.completion.chunk" || hasJSONValue(envelope["choices"]):
		kind = "chat"
		usageRaw = envelope["usage"]
	default:
		if jsonObject(envelope["usage"]) {
			usageRaw = envelope["usage"]
			if looksLikeResponsesUsage(usageRaw) {
				kind = "responses"
			} else {
				kind = "chat"
			}
		}
	}
	if !jsonObject(usageRaw) {
		return nil, ""
	}
	var usage Usage
	if err := json.Unmarshal(usageRaw, &usage); err != nil {
		return nil, ""
	}
	if kind == "responses" {
		usage.PrepareResponsesBilling()
	} else {
		usage.PrepareChatBilling()
	}
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 && usage.InputTokens == 0 && usage.OutputTokens == 0 {
		return nil, ""
	}
	return &usage, kind
}

func jsonObject(raw json.RawMessage) bool {
	raw = bytes.TrimSpace(raw)
	return len(raw) > 0 && raw[0] == '{'
}

func hasJSONValue(raw json.RawMessage) bool {
	raw = bytes.TrimSpace(raw)
	return len(raw) > 0 && string(raw) != "null"
}

func looksLikeResponsesUsage(raw json.RawMessage) bool {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return false
	}
	_, input := fields["input_tokens"]
	_, output := fields["output_tokens"]
	_, prompt := fields["prompt_tokens"]
	_, completion := fields["completion_tokens"]
	return (input || output) && !prompt && !completion
}

// ExtractUsageJSON returns the inner usage object when `data` is a full model
// response envelope (choices / output / chat.completion). Otherwise it returns data as-is.
func ExtractUsageJSON(data []byte) []byte {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return data
	}
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &envelope); err != nil {
		return data
	}
	nested, ok := envelope["usage"]
	if !ok {
		return data
	}
	nested = bytes.TrimSpace(nested)
	if len(nested) == 0 || nested[0] != '{' {
		return data
	}
	// Keep a real usage object as-is. Unwrap chat/image/response envelopes
	// that only contain usage as a nested field (including gpt-image b64 payloads).
	if looksLikeUsageFields(envelope) {
		return data
	}
	if looksLikeUsageRaw(nested) {
		return nested
	}
	return data
}

func looksLikeUsageRaw(raw json.RawMessage) bool {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return false
	}
	return looksLikeUsageFields(fields)
}

func looksLikeUsageFields(fields map[string]json.RawMessage) bool {
	for _, key := range []string{"prompt_tokens", "completion_tokens", "input_tokens", "output_tokens", "total_tokens"} {
		if _, ok := fields[key]; ok {
			return true
		}
	}
	return false
}

// EnsureChatTokenFields copies Responses-style input/output tokens onto the
// chat-completion fields used by billing, and recovers tokens from a nested
// usage envelope when the struct was unmarshaled from a full response body.
func (u *Usage) EnsureChatTokenFields() {
	if u == nil {
		return
	}
	if u.PromptTokens == 0 && u.CompletionTokens == 0 && len(u.OriginalUsageJSON) > 0 {
		extracted := ExtractUsageJSON(u.OriginalUsageJSON)
		type tokenAlias struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			InputTokens      int `json:"input_tokens"`
			OutputTokens     int `json:"output_tokens"`
		}
		var decoded tokenAlias
		if err := json.Unmarshal(extracted, &decoded); err == nil {
			u.PromptTokens = decoded.PromptTokens
			u.CompletionTokens = decoded.CompletionTokens
			if u.PromptTokens == 0 {
				u.PromptTokens = decoded.InputTokens
			}
			if u.CompletionTokens == 0 {
				u.CompletionTokens = decoded.OutputTokens
			}
			if !bytes.Equal(bytes.TrimSpace(extracted), bytes.TrimSpace(u.OriginalUsageJSON)) {
				u.OriginalUsageJSON = append(json.RawMessage(nil), extracted...)
			}
		}
	}
	if u.PromptTokens == 0 && u.InputTokens > 0 {
		u.PromptTokens = u.InputTokens
	}
	if u.CompletionTokens == 0 && u.OutputTokens > 0 {
		u.CompletionTokens = u.OutputTokens
	}
	if u.TotalTokens == 0 {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
}

// PrepareResponsesBilling keeps Responses input/output counts authoritative
// for quota, even when a converted prompt/completion copy is also present.
func (u *Usage) PrepareResponsesBilling() {
	if u == nil {
		return
	}
	u.useOriginalTokenFields("responses")
	u.EnsureChatTokenFields()
	u.NormalizeInputTokenDetails()
	u.NormalizeOutputTokenDetails()
}

// PrepareChatBilling keeps Chat Completions prompt/completion counts
// authoritative for quota.
func (u *Usage) PrepareChatBilling() {
	if u == nil {
		return
	}
	u.useOriginalTokenFields("chat")
	u.EnsureChatTokenFields()
	u.NormalizeInputTokenDetails()
	u.NormalizeOutputTokenDetails()
}

func (u *Usage) useOriginalTokenFields(kind string) {
	if u == nil || len(u.OriginalUsageJSON) == 0 {
		return
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(u.OriginalUsageJSON, &fields); err != nil {
		return
	}
	readInt := func(key string) (int, bool) {
		raw, ok := fields[key]
		if !ok {
			return 0, false
		}
		raw = bytes.TrimSpace(raw)
		if len(raw) == 0 || string(raw) == "null" {
			return 0, false
		}
		var n float64
		if err := json.Unmarshal(raw, &n); err != nil {
			return 0, false
		}
		return int(n), true
	}
	switch kind {
	case "responses":
		if n, ok := readInt("input_tokens"); ok {
			u.InputTokens = n
			u.PromptTokens = n
		}
		if n, ok := readInt("output_tokens"); ok {
			u.OutputTokens = n
			u.CompletionTokens = n
		}
		if _, ok := fields["input_tokens_details"]; ok && u.InputTokensDetails != nil {
			u.PromptTokensDetails = *u.InputTokensDetails
			u.PromptTokensDetails.normalizeCacheWrite()
		}
		if _, ok := fields["output_tokens_details"]; ok && u.OutputTokensDetails != nil {
			u.CompletionTokenDetails = *u.OutputTokensDetails
		}
	case "chat":
		if n, ok := readInt("prompt_tokens"); ok {
			u.PromptTokens = n
		}
		if n, ok := readInt("completion_tokens"); ok {
			u.CompletionTokens = n
		}
		if _, ok := fields["completion_tokens_details"]; ok {
			// Chat completions report reasoning on completion_tokens_details.
			// Drop a converted output_tokens_details copy when both are present.
			if raw, exists := fields["completion_tokens_details"]; exists && jsonObject(raw) {
				var details OutputTokenDetails
				if err := json.Unmarshal(raw, &details); err == nil {
					u.CompletionTokenDetails = details
				}
			}
		}
	}
	if n, ok := readInt("total_tokens"); ok {
		u.TotalTokens = n
	}
}

type OpenAIVideoResponse struct {
	Id        string `json:"id" example:"file-abc123"`
	Object    string `json:"object" example:"file"`
	Bytes     int64  `json:"bytes" example:"120000"`
	CreatedAt int64  `json:"created_at" example:"1677610602"`
	ExpiresAt int64  `json:"expires_at" example:"1677614202"`
	Filename  string `json:"filename" example:"mydata.jsonl"`
	Purpose   string `json:"purpose" example:"fine-tune"`
}

type InputTokenDetails struct {
	CachedTokens         int `json:"cached_tokens"`
	CachedCreationTokens int `json:"cached_creation_tokens,omitempty"`
	// CacheWriteTokens is the official OpenAI field (GPT-5.6+):
	// Responses: usage.input_tokens_details.cache_write_tokens
	// Chat Completions: usage.prompt_tokens_details.cache_write_tokens
	CacheWriteTokens int `json:"cache_write_tokens,omitempty"`
	TextTokens       int `json:"text_tokens"`
	AudioTokens      int `json:"audio_tokens"`
	ImageTokens      int `json:"image_tokens"`
}

func (d *InputTokenDetails) normalizeCacheWrite() {
	if d == nil {
		return
	}
	if d.CachedCreationTokens == 0 && d.CacheWriteTokens > 0 {
		d.CachedCreationTokens = d.CacheWriteTokens
	}
	if d.CacheWriteTokens == 0 && d.CachedCreationTokens > 0 {
		d.CacheWriteTokens = d.CachedCreationTokens
	}
}

// NormalizeInputTokenDetails folds OpenAI Responses input_tokens_details and
// cache_write_tokens into prompt_tokens_details so billing/logs see cache writes.
func (u *Usage) NormalizeInputTokenDetails() {
	if u == nil {
		return
	}
	u.PromptTokensDetails.normalizeCacheWrite()
	if u.InputTokensDetails == nil {
		return
	}
	u.InputTokensDetails.normalizeCacheWrite()
	src := u.InputTokensDetails
	if u.PromptTokensDetails.CachedTokens == 0 {
		u.PromptTokensDetails.CachedTokens = src.CachedTokens
	}
	if u.PromptTokensDetails.CachedCreationTokens == 0 {
		u.PromptTokensDetails.CachedCreationTokens = src.CachedCreationTokens
	}
	if u.PromptTokensDetails.CacheWriteTokens == 0 {
		u.PromptTokensDetails.CacheWriteTokens = src.CacheWriteTokens
	}
	if u.PromptTokensDetails.ImageTokens == 0 {
		u.PromptTokensDetails.ImageTokens = src.ImageTokens
	}
	if u.PromptTokensDetails.AudioTokens == 0 {
		u.PromptTokensDetails.AudioTokens = src.AudioTokens
	}
	if u.PromptTokensDetails.TextTokens == 0 {
		u.PromptTokensDetails.TextTokens = src.TextTokens
	}
	u.PromptTokensDetails.normalizeCacheWrite()
}

// NormalizeOutputTokenDetails copies Responses output_tokens_details onto the
// completion details used by logs when the chat field was not reported.
func (u *Usage) NormalizeOutputTokenDetails() {
	if u == nil || u.OutputTokensDetails == nil {
		return
	}
	src := u.OutputTokensDetails
	if u.CompletionTokenDetails.ReasoningTokens == 0 {
		u.CompletionTokenDetails.ReasoningTokens = src.ReasoningTokens
	}
	if u.CompletionTokenDetails.TextTokens == 0 {
		u.CompletionTokenDetails.TextTokens = src.TextTokens
	}
	if u.CompletionTokenDetails.AudioTokens == 0 {
		u.CompletionTokenDetails.AudioTokens = src.AudioTokens
	}
	if u.CompletionTokenDetails.ImageTokens == 0 {
		u.CompletionTokenDetails.ImageTokens = src.ImageTokens
	}
}

type OutputTokenDetails struct {
	TextTokens      int `json:"text_tokens"`
	AudioTokens     int `json:"audio_tokens"`
	ReasoningTokens int `json:"reasoning_tokens"`
	ImageTokens     int `json:"image_tokens"`
}

type OpenAIResponsesResponse struct {
	ID                 string             `json:"id"`
	Object             string             `json:"object"`
	CreatedAt          IntValue           `json:"created_at"`
	Status             json.RawMessage    `json:"status"`
	Error              any                `json:"error,omitempty"`
	IncompleteDetails  *IncompleteDetails `json:"incomplete_details,omitempty"`
	Instructions       *string            `json:"instructions"`
	MaxOutputTokens    *int               `json:"max_output_tokens"`
	Model              string             `json:"model"`
	Output             []ResponsesOutput  `json:"output"`
	ParallelToolCalls  *bool              `json:"parallel_tool_calls"`
	PreviousResponseID json.RawMessage    `json:"previous_response_id"`
	Reasoning          *Reasoning         `json:"reasoning"`
	Store              *bool              `json:"store"`
	Temperature        *float64           `json:"temperature"`
	ToolChoice         json.RawMessage    `json:"tool_choice"`
	Tools              []map[string]any   `json:"tools"`
	TopP               *float64           `json:"top_p"`
	Truncation         json.RawMessage    `json:"truncation"`
	Usage              *Usage             `json:"usage"`
	User               json.RawMessage    `json:"user"`
	Metadata           json.RawMessage    `json:"metadata"`
}

// GetOpenAIError 从动态错误类型中提取OpenAIError结构
func (o *OpenAIResponsesResponse) GetOpenAIError() *types.OpenAIError {
	return GetOpenAIError(o.Error)
}

func (o *OpenAIResponsesResponse) HasImageGenerationCall() bool {
	if len(o.Output) == 0 {
		return false
	}
	for _, output := range o.Output {
		if output.Type == ResponsesOutputTypeImageGenerationCall {
			return true
		}
	}
	return false
}

func (o *OpenAIResponsesResponse) GetQuality() string {
	if len(o.Output) == 0 {
		return ""
	}
	for _, output := range o.Output {
		if output.Type == ResponsesOutputTypeImageGenerationCall {
			return output.Quality
		}
	}
	return ""
}

func (o *OpenAIResponsesResponse) GetSize() string {
	if len(o.Output) == 0 {
		return ""
	}
	for _, output := range o.Output {
		if output.Type == ResponsesOutputTypeImageGenerationCall {
			return output.Size
		}
	}
	return ""
}

type IncompleteDetails struct {
	Reasoning string `json:"reasoning"`
}

type ResponsesOutput struct {
	Type      string                   `json:"type"`
	ID        string                   `json:"id"`
	Status    string                   `json:"status"`
	Role      string                   `json:"role"`
	Content   []ResponsesOutputContent `json:"content"`
	Quality   string                   `json:"quality"`
	Size      string                   `json:"size"`
	CallId    string                   `json:"call_id,omitempty"`
	Name      string                   `json:"name,omitempty"`
	Arguments FlexString               `json:"arguments,omitempty"`
}

type ResponsesOutputContent struct {
	Type        string        `json:"type"`
	Text        string        `json:"text"`
	Annotations []interface{} `json:"annotations"`
}

func (c *ResponsesOutputContent) UnmarshalJSON(data []byte) error {
	var aux struct {
		Type        string          `json:"type"`
		Text        json.RawMessage `json:"text"`
		Annotations []interface{}   `json:"annotations"`
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	c.Type = aux.Type
	c.Text = jsonText(aux.Text)
	c.Annotations = aux.Annotations
	return nil
}

type ResponsesReasoningSummaryPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

const (
	BuildInToolWebSearchPreview           = "web_search_preview"
	BuildInToolFileSearch                 = "file_search"
	BuildInToolGoogleSearch               = "google_search"
	BuildInToolGoogleSearchGroundedPrompt = "google_search_grounded_prompt"
)

const (
	BuildInCallWebSearchCall = "web_search_call"
)

const (
	ResponsesOutputTypeItemAdded = "response.output_item.added"
	ResponsesOutputTypeItemDone  = "response.output_item.done"
)

// ResponsesStreamResponse 用于处理 /v1/responses 流式响应
type ResponsesStreamResponse struct {
	Type     string                   `json:"type"`
	Response *OpenAIResponsesResponse `json:"response,omitempty"`
	Delta    string                   `json:"delta,omitempty"`
	Item     *ResponsesOutput         `json:"item,omitempty"`
	// - response.function_call_arguments.delta
	// - response.function_call_arguments.done
	OutputIndex  *int                           `json:"output_index,omitempty"`
	ContentIndex *int                           `json:"content_index,omitempty"`
	SummaryIndex *int                           `json:"summary_index,omitempty"`
	ItemID       string                         `json:"item_id,omitempty"`
	Part         *ResponsesReasoningSummaryPart `json:"part,omitempty"`
}

// GetOpenAIError 从动态错误类型中提取OpenAIError结构
func GetOpenAIError(errorField any) *types.OpenAIError {
	if errorField == nil {
		return nil
	}

	switch err := errorField.(type) {
	case types.OpenAIError:
		return &err
	case *types.OpenAIError:
		return err
	case map[string]interface{}:
		// 处理从JSON解析来的map结构
		openaiErr := &types.OpenAIError{}
		if errType, ok := err["type"].(string); ok {
			openaiErr.Type = errType
		}
		if errMsg, ok := err["message"].(string); ok {
			openaiErr.Message = errMsg
		}
		if errParam, ok := err["param"].(string); ok {
			openaiErr.Param = errParam
		}
		if errCode, ok := err["code"]; ok {
			openaiErr.Code = errCode
		}
		return openaiErr
	case string:
		// 处理简单字符串错误
		return &types.OpenAIError{
			Type:    "error",
			Message: err,
		}
	default:
		// 未知类型，尝试转换为字符串
		return &types.OpenAIError{
			Type:    "unknown_error",
			Message: fmt.Sprintf("%v", err),
		}
	}
}
