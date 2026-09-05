package common

import "github.com/QuantumNous/new-api/constant"

func ChannelType2APIType(channelType int) (int, bool) {
	apiType := -1
	switch channelType {
	case constant.ChannelTypeOpenAI:
		apiType = constant.APITypeOpenAI
	case constant.ChannelTypeAnthropic:
		apiType = constant.APITypeAnthropic
	case constant.ChannelTypeBaidu:
		apiType = constant.APITypeBaidu
	case constant.ChannelTypePaLM:
		apiType = constant.APITypePaLM
	case constant.ChannelTypeZhipu:
		apiType = constant.APITypeZhipu
	case constant.ChannelTypeXunfei:
		apiType = constant.APITypeXunfei
	case constant.ChannelTypeAIProxyLibrary:
		apiType = constant.APITypeAIProxyLibrary
	case constant.ChannelTypeGemini:
		apiType = constant.APITypeGemini
	case constant.ChannelTypeZhipu_v4:
		apiType = constant.APITypeZhipuV4
	case constant.ChannelTypeAws:
		apiType = constant.APITypeAws
	case constant.ChannelTypeCohere:
		apiType = constant.APITypeCohere
	case constant.ChannelTypeDify:
		apiType = constant.APITypeDify
	case constant.ChannelTypeJina:
		apiType = constant.APITypeJina
	case constant.ChannelCloudflare:
		apiType = constant.APITypeCloudflare
	case constant.ChannelTypeVertexAi:
		apiType = constant.APITypeVertexAi
	case constant.ChannelTypeDeepSeek:
		apiType = constant.APITypeDeepSeek
	case constant.ChannelTypeBaiduV2:
		apiType = constant.APITypeBaiduV2
	case constant.ChannelTypeOpenRouter:
		apiType = constant.APITypeOpenRouter
	case constant.ChannelTypeXinference:
		apiType = constant.APITypeXinference
	case constant.ChannelTypeXai:
		apiType = constant.APITypeXai
	case constant.ChannelTypeSubmodel:
		apiType = constant.APITypeSubmodel
	case constant.ChannelTypeReplicate:
		apiType = constant.APITypeReplicate
	case constant.ChannelTypeCodex:
		apiType = constant.APITypeCodex
	}
	if apiType == -1 {
		return constant.APITypeOpenAI, false
	}
	return apiType, true
}
