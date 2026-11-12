package openai

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// responsesStreamUsageAccumulator 收集一条 Responses 流的计费事实，流结束（无论
// 正常结束、failed、EOF 断流、超时还是客户端断开）后由 Finish 兜底补全 usage。
//
// 上游一开始生成就已经按输入计费，流被中断时往往拿不到 usage，网关不兜底就会出现
// 「上游扣了钱、下游没扣」的空账。规则：
//   - 上游没报输出 token：按已产出的内容（正文/reasoning/函数参数/refusal，或终止
//     事件里携带的 output）估算；
//   - 上游没报输入 token：只要产出过内容，或流已开始且上游没有明确报失败，就用
//     预估输入补上；
//   - 上游明确失败且什么都没产出：保持零用量，由上层退款。
type responsesStreamUsageAccumulator struct {
	output       strings.Builder
	terminalText string
	started      bool
	failed       bool
}

// Touch 记录收到过上游事件（包括解析失败的事件）。
func (a *responsesStreamUsageAccumulator) Touch() {
	if a != nil {
		a.started = true
	}
}

func (a *responsesStreamUsageAccumulator) Observe(event *dto.ResponsesStreamResponse) {
	if a == nil || event == nil {
		return
	}
	a.started = true

	switch event.Type {
	case "error", "response.failed", "response.error":
		a.failed = true
	}
	if event.Response != nil {
		var status string
		if len(event.Response.Status) > 0 {
			_ = common.Unmarshal(event.Response.Status, &status)
		}
		if status == "failed" {
			a.failed = true
		}
	}

	switch event.Type {
	case "response.output_text.delta", "response.function_call_arguments.delta",
		"response.reasoning_summary_text.delta", "response.reasoning_text.delta",
		"response.refusal.delta":
		a.output.WriteString(event.Delta)
	case "response.completed", "response.done", "response.failed", "response.error",
		"response.incomplete", "response.cancelled", "response.canceled":
		// 部分上游只在终止事件里带完整输出。
		if event.Response != nil && a.terminalText == "" {
			a.terminalText = service.ExtractOutputTextFromResponses(event.Response)
		}
	}
}

// Finish 原地补全 usage 并返回。无任何可计费事实时 usage 保持为零。
func (a *responsesStreamUsageAccumulator) Finish(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage) *dto.Usage {
	if usage == nil {
		usage = &dto.Usage{}
	}
	usage.EnsureChatTokenFields()
	if a == nil || info == nil {
		return usage
	}

	estimated := false
	if usage.CompletionTokens == 0 {
		text := a.output.String()
		if text == "" {
			text = a.terminalText
		}
		if text != "" {
			modelName := info.OriginModelName
			if info.ChannelMeta != nil && info.UpstreamModelName != "" {
				modelName = info.UpstreamModelName
			}
			if tokens := service.CountTextToken(text, modelName); tokens > 0 {
				usage.CompletionTokens = tokens
				estimated = true
			}
		}
	}

	billsPrompt := usage.CompletionTokens != 0 || (a.started && !a.failed)
	if usage.PromptTokens == 0 && billsPrompt {
		if prompt := info.GetEstimatePromptTokens(); prompt > 0 {
			usage.PromptTokens = prompt
			estimated = true
		}
	}

	if estimated {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		if c != nil {
			c.Set(service.ContextKeyStreamFailureEstimatedUsage, true)
		}
	}
	return usage
}
