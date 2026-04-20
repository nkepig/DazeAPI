package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// from songquanpeng/one-api
const (
	USD2RMB = 7.3 // 暂定 1 USD = 7.3 RMB
	USD     = 500 // $0.002 = 1 -> $1 = 500
	RMB     = USD / USD2RMB
)

// modelRatio
// https://platform.openai.com/docs/models/model-endpoint-compatibility
// https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Blfmc9dlf
// https://openai.com/pricing
// TODO: when a new api is enabled, check the pricing here
// 1 === $0.002 / 1K tokens
// 1 === ￥0.014 / 1k tokens

var defaultModelPrice = map[string]float64{
	"suno_music":                     0.1,
	"suno_lyrics":                    0.01,
	"dall-e-3":                       0.04,
	"imagen-3.0-generate-002":        0.03,
	"black-forest-labs/flux-1.1-pro": 0.04,
	"gpt-4-gizmo-*":                  0.1,
	"mj_video":                       0.8,
	"mj_imagine":                     0.1,
	"mj_edits":                       0.1,
	"mj_variation":                   0.1,
	"mj_reroll":                      0.1,
	"mj_blend":                       0.1,
	"mj_modal":                       0.1,
	"mj_zoom":                        0.1,
	"mj_shorten":                     0.1,
	"mj_high_variation":              0.1,
	"mj_low_variation":               0.1,
	"mj_pan":                         0.1,
	"mj_inpaint":                     0,
	"mj_custom_zoom":                 0,
	"mj_describe":                    0.05,
	"mj_upscale":                     0.05,
	"swap_face":                      0.05,
	"mj_upload":                      0.05,
	"sora-2":                         0.3,
	"sora-2-pro":                     0.5,
	"gpt-4o-mini-tts":                0.3,
	"veo-3.0-generate-001":           0.4,
	"veo-3.0-fast-generate-001":      0.15,
	"veo-3.1-generate-preview":       0.4,
	"veo-3.1-fast-generate-preview":  0.15,
}

var defaultAudioRatio = map[string]float64{
	"gpt-4o-audio-preview":         16,
	"gpt-4o-mini-audio-preview":    66.67,
	"gpt-4o-realtime-preview":      8,
	"gpt-4o-mini-realtime-preview": 16.67,
	"gpt-4o-mini-tts":              25,
}

var defaultAudioCompletionRatio = map[string]float64{
	"gpt-4o-realtime":      2,
	"gpt-4o-mini-realtime": 2,
	"gpt-4o-mini-tts":      1,
	"tts-1":                0,
	"tts-1-hd":             0,
	"tts-1-1106":           0,
	"tts-1-hd-1106":        0,
}

var modelPriceMap = types.NewRWMap[string, float64]()
var completionRatioMap = types.NewRWMap[string, float64]()

var defaultCompletionRatio = map[string]float64{
	"gpt-4-gizmo-*":  2,
	"gpt-4o-gizmo-*": 3,
	"gpt-4-all":      2,
	"gpt-image-1":    8,
}

// InitRatioSettings initializes all model related settings maps
func InitRatioSettings() {
	modelPriceMap.AddAll(defaultModelPrice)
	completionRatioMap.AddAll(defaultCompletionRatio)
	cacheRatioMap.AddAll(defaultCacheRatio)
	createCacheRatioMap.AddAll(defaultCreateCacheRatio)
	imageRatioMap.AddAll(defaultImageRatio)
	audioRatioMap.AddAll(defaultAudioRatio)
	audioCompletionRatioMap.AddAll(defaultAudioCompletionRatio)
}

func GetModelPriceMap() map[string]float64 {
	return modelPriceMap.ReadAll()
}

func ModelPrice2JSONString() string {
	return modelPriceMap.MarshalJSONString()
}

func UpdateModelPriceByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelPriceMap, jsonStr, InvalidateExposedDataCache)
}

// GetModelPrice 返回模型的价格，如果模型不存在则返回-1，false
func GetModelPrice(name string, printErr bool) (float64, bool) {
	name = FormatMatchingModelName(name)

	if strings.HasSuffix(name, CompactModelSuffix) {
		price, ok := modelPriceMap.Get(CompactWildcardModelKey)
		if !ok {
			if printErr {
				common.SysError("model price not found: " + name)
			}
			return -1, false
		}
		return price, true
	}

	price, ok := modelPriceMap.Get(name)
	if !ok {
		if printErr {
			common.SysError("model price not found: " + name)
		}
		return -1, false
	}
	return price, true
}

// 处理带有思考预算的模型名称，方便统一定价
func handleThinkingBudgetModel(name, prefix, wildcard string) string {
	if strings.HasPrefix(name, prefix) && strings.Contains(name, "-thinking-") {
		return wildcard
	}
	return name
}



func GetDefaultModelPriceMap() map[string]float64 {
	return defaultModelPrice
}



func GetCompletionRatio(name string) float64 {
	name = FormatMatchingModelName(name)

	if strings.Contains(name, "/") {
		if ratio, ok := completionRatioMap.Get(name); ok {
			return ratio
		}
	}
	hardCodedRatio, contain := getHardcodedCompletionRatioDefault(name)
	if contain {
		return hardCodedRatio
	}
	if ratio, ok := completionRatioMap.Get(name); ok {
		return ratio
	}
	return hardCodedRatio
}



func getHardcodedCompletionRatioDefault(name string) (float64, bool) {

	isReservedModel := strings.HasSuffix(name, "-all") || strings.HasSuffix(name, "-gizmo-*")
	if isReservedModel {
		return 2, false
	}

	if strings.HasPrefix(name, "gpt-") {
		if strings.HasPrefix(name, "gpt-4o") {
			if name == "gpt-4o-2024-05-13" {
				return 3, true
			}
			if strings.HasPrefix(name, "gpt-4o-mini-tts") {
				return 20, false
			}
			return 4, false
		}
		// gpt-5 匹配
		if strings.HasPrefix(name, "gpt-5") {
			if strings.HasPrefix(name, "gpt-5.4") {
				if strings.HasPrefix(name, "gpt-5.4-nano") {
					return 6.25, true
				}
				return 6, true
			}
			return 8, true
		}
		// gpt-4.5-preview匹配
		if strings.HasPrefix(name, "gpt-4.5-preview") {
			return 2, true
		}
		if strings.HasPrefix(name, "gpt-4-turbo") || strings.HasSuffix(name, "gpt-4-1106") || strings.HasSuffix(name, "gpt-4-1105") {
			return 3, true
		}
		// 没有特殊标记的 gpt-4 模型默认倍率为 2
		return 2, false
	}
	if strings.HasPrefix(name, "o1") || strings.HasPrefix(name, "o3") {
		return 4, true
	}
	if name == "chatgpt-4o-latest" {
		return 3, true
	}

	if strings.Contains(name, "claude-3") {
		return 5, true
	} else if strings.Contains(name, "claude-sonnet-4") || strings.Contains(name, "claude-opus-4") || strings.Contains(name, "claude-haiku-4") {
		return 5, true
	}

	if strings.HasPrefix(name, "gpt-3.5") {
		if name == "gpt-3.5-turbo" || strings.HasSuffix(name, "0125") {
			// https://openai.com/blog/new-embedding-models-and-api-updates
			// Updated GPT-3.5 Turbo model and lower pricing
			return 3, true
		}
		if strings.HasSuffix(name, "1106") {
			return 2, true
		}
		return 4.0 / 3.0, true
	}
	if strings.HasPrefix(name, "mistral-") {
		return 3, true
	}
	if strings.HasPrefix(name, "gemini-") {
		if strings.HasPrefix(name, "gemini-1.5") {
			return 4, true
		} else if strings.HasPrefix(name, "gemini-2.0") {
			return 4, true
		} else if strings.HasPrefix(name, "gemini-2.5-pro") { // 移除preview来增加兼容性，这里假设正式版的倍率和preview一致
			return 8, false
		} else if strings.HasPrefix(name, "gemini-2.5-flash") { // 处理不同的flash模型倍率
			if strings.HasPrefix(name, "gemini-2.5-flash-preview") {
				if strings.HasSuffix(name, "-nothinking") {
					return 4, false
				}
				return 3.5 / 0.15, false
			}
			if strings.HasPrefix(name, "gemini-2.5-flash-lite") {
				return 4, false
			}
			return 2.5 / 0.3, false
		} else if strings.HasPrefix(name, "gemini-robotics-er-1.5") {
			return 2.5 / 0.3, false
		} else if strings.HasPrefix(name, "gemini-3-pro") {
			if strings.HasPrefix(name, "gemini-3-pro-image") {
				return 60, false
			}
			return 6, false
		}
		return 4, false
	}
	if strings.HasPrefix(name, "command") {
		switch name {
		case "command-r":
			return 3, true
		case "command-r-plus":
			return 5, true
		case "command-r-08-2024":
			return 4, true
		case "command-r-plus-08-2024":
			return 4, true
		default:
			return 4, false
		}
	}
	// hint 只给官方上4倍率，由于开源模型供应商自行定价，不对其进行补全倍率进行强制对齐
	if strings.HasPrefix(name, "ERNIE-Speed-") {
		return 2, true
	} else if strings.HasPrefix(name, "ERNIE-Lite-") {
		return 2, true
	} else if strings.HasPrefix(name, "ERNIE-Character") {
		return 2, true
	} else if strings.HasPrefix(name, "ERNIE-Functions") {
		return 2, true
	}
	switch name {
	case "llama2-70b-4096":
		return 0.8 / 0.64, true
	case "llama3-8b-8192":
		return 2, true
	case "llama3-70b-8192":
		return 0.79 / 0.59, true
	}
	return 1, false
}

func GetAudioRatio(name string) float64 {
	name = FormatMatchingModelName(name)
	if ratio, ok := audioRatioMap.Get(name); ok {
		return ratio
	}
	return 1
}

func GetAudioCompletionRatio(name string) float64 {
	name = FormatMatchingModelName(name)
	if ratio, ok := audioCompletionRatioMap.Get(name); ok {
		return ratio
	}
	return 1
}

func ContainsAudioRatio(name string) bool {
	name = FormatMatchingModelName(name)
	_, ok := audioRatioMap.Get(name)
	return ok
}

func ContainsAudioCompletionRatio(name string) bool {
	name = FormatMatchingModelName(name)
	_, ok := audioCompletionRatioMap.Get(name)
	return ok
}


var defaultImageRatio = map[string]float64{
	"gpt-image-1": 2,
}
var imageRatioMap = types.NewRWMap[string, float64]()
var audioRatioMap = types.NewRWMap[string, float64]()
var audioCompletionRatioMap = types.NewRWMap[string, float64]()

func ImageRatio2JSONString() string {
	return imageRatioMap.MarshalJSONString()
}


func GetImageRatio(name string) (float64, bool) {
	ratio, ok := imageRatioMap.Get(name)
	if !ok {
		return 1, false // Default to 1 if not found
	}
	return ratio, true
}

func AudioRatio2JSONString() string {
	return audioRatioMap.MarshalJSONString()
}





func GetModelPriceCopy() map[string]float64 {
	return modelPriceMap.ReadAll()
}


// 转换模型名，减少渠道必须配置各种带参数模型
func FormatMatchingModelName(name string) string {

	if strings.HasPrefix(name, "gemini-2.5-flash-lite") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-flash") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-flash", "gemini-2.5-flash-thinking-*")
	} else if strings.HasPrefix(name, "gemini-2.5-pro") {
		name = handleThinkingBudgetModel(name, "gemini-2.5-pro", "gemini-2.5-pro-thinking-*")
	}

	if strings.HasPrefix(name, "gpt-4-gizmo") {
		name = "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(name, "gpt-4o-gizmo") {
		name = "gpt-4o-gizmo-*"
	}
	return name
}


func IsModelConfigured(name string) bool {
	name = FormatMatchingModelName(name)
	
	if _, ok := modelPriceMap.Get(name); ok {
		return true
	}
	
	if strings.HasSuffix(name, CompactModelSuffix) {
		if _, ok := modelPriceMap.Get(CompactWildcardModelKey); ok {
			return true
		}
	}
	
	return false
}
