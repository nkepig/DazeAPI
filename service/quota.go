package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/pricing"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type TokenDetails struct {
	TextTokens  int
	AudioTokens int
}

type QuotaInfo struct {
	InputDetails  TokenDetails
	OutputDetails TokenDetails
	ModelName     string
	UsePerCall    bool
	PerCallPrice  float64
	PromptPrice   float64
	CompletionPrice float64
	AudioInputPrice float64
	AudioOutputPrice float64
	GroupDiscount float64
}

func calculateAudioQuota(info QuotaInfo) int64 {
	microdollarsPerMillion := decimal.NewFromInt(pricing.MicrodollarsPerDollar)
	groupDiscount := decimal.NewFromFloat(info.GroupDiscount)

	if info.UsePerCall {
		quota := decimal.NewFromFloat(info.PerCallPrice).Mul(microdollarsPerMillion).Mul(groupDiscount)
		return quota.IntPart()
	}

	dPromptPrice := decimal.NewFromFloat(info.PromptPrice)
	dCompletionPrice := decimal.NewFromFloat(info.CompletionPrice)
	dAudioInputPrice := decimal.NewFromFloat(info.AudioInputPrice)
	dAudioOutputPrice := decimal.NewFromFloat(info.AudioOutputPrice)

	inputTextTokens := decimal.NewFromInt(int64(info.InputDetails.TextTokens))
	outputTextTokens := decimal.NewFromInt(int64(info.OutputDetails.TextTokens))
	inputAudioTokens := decimal.NewFromInt(int64(info.InputDetails.AudioTokens))
	outputAudioTokens := decimal.NewFromInt(int64(info.OutputDetails.AudioTokens))

	textInputCost := inputTextTokens.Mul(dPromptPrice)
	textOutputCost := outputTextTokens.Mul(dCompletionPrice)
	audioInputCost := inputAudioTokens.Mul(dAudioInputPrice)
	audioOutputCost := outputAudioTokens.Mul(dAudioOutputPrice)

	totalCost := textInputCost.Add(textOutputCost).Add(audioInputCost).Add(audioOutputCost)
	totalCost = totalCost.Mul(groupDiscount)

	return totalCost.Round(0).IntPart()
}

func PreWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) error {
	if relayInfo.PriceData.UsePerCallPricing {
		return nil
	}
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return err
	}

	token, err := model.GetTokenByKey(strings.TrimPrefix(relayInfo.TokenKey, "sk-"), false)
	if err != nil {
		return err
	}

	modelName := relayInfo.OriginModelName
	textInputTokens := usage.InputTokenDetails.TextTokens
	textOutTokens := usage.OutputTokenDetails.TextTokens
	audioInputTokens := usage.InputTokenDetails.AudioTokens
	audioOutTokens := usage.OutputTokenDetails.AudioTokens

	groupDiscount := relayInfo.PriceData.GroupDiscountInfo.GroupDiscount
	modelPricing, found := pricing.GetModelPricing(modelName)
	if !found {
		return fmt.Errorf("model pricing not found: %s", modelName)
	}

	quotaInfo := QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  textInputTokens,
			AudioTokens: audioInputTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:       modelName,
		UsePerCall:      modelPricing.UsePerCallPricing,
		PerCallPrice:    modelPricing.PerCallPrice,
		PromptPrice:     modelPricing.PromptPrice,
		CompletionPrice: modelPricing.CompletionPrice,
		AudioInputPrice: modelPricing.AudioInputPrice,
		AudioOutputPrice: modelPricing.AudioOutputPrice,
		GroupDiscount:   groupDiscount,
	}

	quotaMicrodollars := calculateAudioQuota(quotaInfo)

	if userQuota < int(quotaMicrodollars) {
		return fmt.Errorf("user quota is not enough, user quota: %s, need quota: %s", logger.FormatQuota(userQuota), logger.FormatQuota(int(quotaMicrodollars)))
	}

	if !token.UnlimitedQuota && token.RemainQuota < int(quotaMicrodollars) {
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(int(quotaMicrodollars)))
	}

	err = PostConsumeQuota(relayInfo, int(quotaMicrodollars), 0, false)
	if err != nil {
		return err
	}
	logger.LogInfo(ctx, "realtime streaming consume quota success, quota: "+fmt.Sprintf("%d", quotaMicrodollars))
	return nil
}

func PostWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelName string,
	usage *dto.RealtimeUsage, extraContent string) {

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textInputTokens := usage.InputTokenDetails.TextTokens
	textOutTokens := usage.OutputTokenDetails.TextTokens

	audioInputTokens := usage.InputTokenDetails.AudioTokens
	audioOutTokens := usage.OutputTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	priceData := relayInfo.PriceData
	groupDiscount := priceData.GroupDiscountInfo.GroupDiscount

	modelPricing, found := pricing.GetModelPricing(modelName)
	if !found {
		logger.LogError(ctx, fmt.Sprintf("model pricing not found: %s", modelName))
		return
	}

	quotaInfo := QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  textInputTokens,
			AudioTokens: audioInputTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:       modelName,
		UsePerCall:      modelPricing.UsePerCallPricing,
		PerCallPrice:    modelPricing.PerCallPrice,
		PromptPrice:     modelPricing.PromptPrice,
		CompletionPrice: modelPricing.CompletionPrice,
		AudioInputPrice: modelPricing.AudioInputPrice,
		AudioOutputPrice: modelPricing.AudioOutputPrice,
		GroupDiscount:   groupDiscount,
	}

	quotaMicrodollars := calculateAudioQuota(quotaInfo)

	totalTokens := usage.TotalTokens
	var logContent string
	if !modelPricing.UsePerCallPricing {
		logContent = fmt.Sprintf("输入价格 %.6f，输出价格 %.6f，音频输入价格 %.6f，音频输出价格 %.6f，分组折扣 %.6f",
			modelPricing.PromptPrice, modelPricing.CompletionPrice, modelPricing.AudioInputPrice, modelPricing.AudioOutputPrice, groupDiscount)
	} else {
		logContent = fmt.Sprintf("按次价格 %.6f，分组折扣 %.6f", modelPricing.PerCallPrice, groupDiscount)
	}

	if totalTokens == 0 {
		quotaMicrodollars = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, modelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, int(quotaMicrodollars))
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, int(quotaMicrodollars))
	}

	logModel := modelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
	other := GenerateWssOtherInfo(ctx, relayInfo, usage, priceData)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            int(quotaMicrodollars),
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}

func CalcOpenRouterCacheCreateTokens(usage dto.Usage, priceData types.PriceData) int {
	if priceData.CacheWritePrice == 0 {
		return 0
	}
	promptPricePerM := priceData.PromptPrice
	promptCacheWritePricePerM := priceData.CacheWritePrice
	promptCacheReadPricePerM := priceData.CacheReadPrice
	completionPricePerM := priceData.CompletionPrice

	cost, _ := usage.Cost.(float64)
	totalPromptTokens := float64(usage.PromptTokens)
	completionTokens := float64(usage.CompletionTokens)
	promptCacheReadTokens := float64(usage.PromptTokensDetails.CachedTokens)

	return int((cost*1_000_000 -
		totalPromptTokens*promptPricePerM +
		promptCacheReadTokens*promptCacheReadPricePerM -
		completionTokens*completionPricePerM) /
		(promptCacheWritePricePerM - promptPricePerM))
}

func PostAudioConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent string) {

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textInputTokens := usage.PromptTokensDetails.TextTokens
	textOutTokens := usage.CompletionTokenDetails.TextTokens

	audioInputTokens := usage.PromptTokensDetails.AudioTokens
	audioOutTokens := usage.CompletionTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	priceData := relayInfo.PriceData
	groupDiscount := priceData.GroupDiscountInfo.GroupDiscount

	modelPricing, found := pricing.GetModelPricing(relayInfo.OriginModelName)
	if !found {
		logger.LogError(ctx, fmt.Sprintf("model pricing not found: %s", relayInfo.OriginModelName))
		return
	}

	quotaInfo := QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  textInputTokens,
			AudioTokens: audioInputTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:       relayInfo.OriginModelName,
		UsePerCall:      modelPricing.UsePerCallPricing,
		PerCallPrice:    modelPricing.PerCallPrice,
		PromptPrice:     modelPricing.PromptPrice,
		CompletionPrice: modelPricing.CompletionPrice,
		AudioInputPrice: modelPricing.AudioInputPrice,
		AudioOutputPrice: modelPricing.AudioOutputPrice,
		GroupDiscount:   groupDiscount,
	}

	quotaMicrodollars := calculateAudioQuota(quotaInfo)

	totalTokens := usage.TotalTokens
	var logContent string
	if !modelPricing.UsePerCallPricing {
		logContent = fmt.Sprintf("输入价格 %.6f，输出价格 %.6f，音频输入价格 %.6f，音频输出价格 %.6f，分组折扣 %.6f",
			modelPricing.PromptPrice, modelPricing.CompletionPrice, modelPricing.AudioInputPrice, modelPricing.AudioOutputPrice, groupDiscount)
	} else {
		logContent = fmt.Sprintf("按次价格 %.6f，分组折扣 %.6f", modelPricing.PerCallPrice, groupDiscount)
	}

	if totalTokens == 0 {
		quotaMicrodollars = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, relayInfo.OriginModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, int(quotaMicrodollars))
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, int(quotaMicrodollars))
	}

	if err := SettleBilling(ctx, relayInfo, int(quotaMicrodollars)); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := relayInfo.OriginModelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
	other := GenerateAudioOtherInfo(ctx, relayInfo, usage, priceData)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            int(quotaMicrodollars),
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}

func PreConsumeTokenQuota(relayInfo *relaycommon.RelayInfo, quota int) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if relayInfo.IsPlayground {
		return nil
	}
	token, err := model.GetTokenByKey(relayInfo.TokenKey, false)
	if err != nil {
		return err
	}
	if !relayInfo.TokenUnlimited && token.RemainQuota < quota {
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(quota))
	}
	err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
	if err != nil {
		return err
	}
	return nil
}

func PostConsumeQuota(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) (err error) {
	if quota > 0 {
		err = model.DecreaseUserQuota(relayInfo.UserId, quota)
	} else {
		err = model.IncreaseUserQuota(relayInfo.UserId, -quota, false)
	}
	if err != nil {
		return err
	}

	if !relayInfo.IsPlayground {
		if quota > 0 {
			err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
		} else {
			err = model.IncreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, -quota)
		}
		if err != nil {
			return err
		}
	}

	if sendEmail {
		if (quota + preConsumedQuota) != 0 {
			checkAndSendQuotaNotify(relayInfo, quota, preConsumedQuota)
		}
	}

	return nil
}

func checkAndSendQuotaNotify(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int) {
	gopool.Go(func() {
		userSetting := relayInfo.UserSetting
		threshold := common.QuotaRemindThreshold
		if userSetting.QuotaWarningThreshold != 0 {
			threshold = int(userSetting.QuotaWarningThreshold)
		}

		quotaTooLow := false
		consumeQuota := quota + preConsumedQuota
		if relayInfo.UserQuota-consumeQuota < threshold {
			quotaTooLow = true
		}
		if quotaTooLow {
			prompt := "您的额度即将用尽"
			topUpLink := fmt.Sprintf("%s/console/topup", system_setting.ServerAddress)

			var content string
			var values []interface{}

			notifyType := userSetting.NotifyType
			if notifyType == "" {
				notifyType = dto.NotifyTypeEmail
			}

			if notifyType == dto.NotifyTypeBark {
				content = "{{value}}，剩余额度：{{value}}，请及时充值"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else if notifyType == dto.NotifyTypeGotify {
				content = "{{value}}，当前剩余额度为 {{value}}，请及时充值。"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else {
				content = "{{value}}，当前剩余额度为 {{value}}，为了不影响您的使用，请及时充值。<br/>充值链接：<a href='{{value}}'>{{value}}</a>"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota), topUpLink, topUpLink}
			}

			err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values))
			if err != nil {
				common.SysError(fmt.Sprintf("failed to send quota notify to user %d: %s", relayInfo.UserId, err.Error()))
			}
		}
	})
}
