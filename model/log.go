package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	asyncLogChanSize    = 5000
	asyncLogBatchSize   = 100
	asyncLogFlushInterval = 2 * time.Second
)

var (
	asyncLogChan chan *Log
	asyncLogOnce sync.Once
)

func initAsyncLogWriter() {
	asyncLogOnce.Do(func() {
		asyncLogChan = make(chan *Log, asyncLogChanSize)
		go asyncLogWorker()
	})
}

func asyncLogWorker() {
	batch := make([]*Log, 0, asyncLogBatchSize)
	ticker := time.NewTicker(asyncLogFlushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := LOG_DB.CreateInBatches(batch, asyncLogBatchSize).Error; err != nil {
			logger.LogError(context.Background(), "async log flush error: "+err.Error())
		}
		batch = batch[:0]
	}

	for {
		select {
		case log := <-asyncLogChan:
			batch = append(batch, log)
			if len(batch) >= asyncLogBatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func enqueueLog(log *Log) {
	initAsyncLogWriter()
	select {
	case asyncLogChan <- log:
	default:
		if err := LOG_DB.Create(log).Error; err != nil {
			common.SysLog("sync log fallback error: " + err.Error())
		}
	}
}

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1;index:idx_user_id_id,priority:2"`
	UserId           int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	RequestId        string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	Other            string `json:"other"`
}

// don't use iota, avoid change log type value
const (
	LogTypeUnknown = 0
	LogTypeTopup   = 1
	LogTypeConsume = 2
	LogTypeManage  = 3
	LogTypeSystem  = 4
	LogTypeError   = 5
	LogTypeRefund  = 6
)

func formatUserLogs(logs []*Log, startIdx int) {
	for i := range logs {
		logs[i].ChannelName = ""
		var otherMap map[string]interface{}
		otherMap, _ = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// Remove admin-only debug fields.
			delete(otherMap, "admin_info")
			delete(otherMap, "reject_reason")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = startIdx + i + 1
	}
}

func GetLogByTokenId(tokenId int) (logs []*Log, err error) {
	err = LOG_DB.Model(&Log{}).Where("token_id = ?", tokenId).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs, 0)
	return logs, err
}

func RecordLog(userId int, logType int, content string) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	enqueueLog(log)
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeError,
		Content:          content,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            0,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	enqueueLog(log)
}

type RecordConsumeLogParams struct {
	ChannelId        int                    `json:"channel_id"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	ModelName        string                 `json:"model_name"`
	TokenName        string                 `json:"token_name"`
	Quota            int                    `json:"quota"`
	Content          string                 `json:"content"`
	TokenId          int                    `json:"token_id"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Group            string                 `json:"group"`
	Other            map[string]interface{} `json:"other"`
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(params.Other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		Content:          params.Content,
		PromptTokens:     params.PromptTokens,
		CompletionTokens: params.CompletionTokens,
		TokenName:        params.TokenName,
		ModelName:        params.ModelName,
		Quota:            params.Quota,
		ChannelId:        params.ChannelId,
		TokenId:          params.TokenId,
		UseTime:          params.UseTimeSeconds,
		IsStream:         params.IsStream,
		Group:            params.Group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	enqueueLog(log)
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, username, params.ModelName, params.Quota, common.GetTimestamp(), params.PromptTokens+params.CompletionTokens)
		})
	}
}

type RecordTaskBillingLogParams struct {
	UserId    int
	LogType   int
	Content   string
	ChannelId int
	ModelName string
	Quota     int
	TokenId   int
	Group     string
	Other     map[string]interface{}
}

func RecordTaskBillingLog(params RecordTaskBillingLogParams) {
	if params.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(params.UserId, false)
	tokenName := ""
	if params.TokenId > 0 {
		if token, err := GetTokenById(params.TokenId); err == nil {
			tokenName = token.Name
		}
	}
	log := &Log{
		UserId:    params.UserId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      params.LogType,
		Content:   params.Content,
		TokenName: tokenName,
		ModelName: params.ModelName,
		Quota:     params.Quota,
		ChannelId: params.ChannelId,
		TokenId:   params.TokenId,
		Group:     params.Group,
		Other:     common.MapToJsonStr(params.Other),
	}
	enqueueLog(log)
}

// GetAllLogs returns logs across all users. When userWhitelist != nil, results
// are restricted to logs whose user_id is in the whitelist (admin fine-grained
// permission: manage_users whitelist). When maskChannelName is true, the
// ChannelName field is cleared before returning (non-root admins must not see
// channel names, only IDs).
func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string, userWhitelist []int, maskChannelName bool) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}

	if modelName != "" {
		tx = tx.Where("logs.model_name like ?", modelName)
	}
	if username != "" {
		tx = tx.Where("logs.username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("logs.channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
	}
	if userWhitelist != nil {
		tx = tx.Where("logs.user_id IN ?", userWhitelist)
	}
	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	// Only resolve channel names when not masked. When masked, leave ChannelName
	// as empty string so the frontend only sees the channel id.
	if !maskChannelName && channelIds.Len() > 0 {
		channelMap := make(map[int]string, channelIds.Len())
		if common.MemoryCacheEnabled {
			channelSyncLock.RLock()
			for _, channelId := range channelIds.Items() {
				if ch, ok := channelsIDM[channelId]; ok {
					channelMap[channelId] = ch.Name
				}
			}
			channelSyncLock.RUnlock()
		} else {
			var channels []struct {
				Id   int    `gorm:"column:id"`
				Name string `gorm:"column:name"`
			}
			if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
				return logs, total, err
			}
			for _, channel := range channels {
				channelMap[channel.Id] = channel.Name
			}
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, err
}

const logSearchCountLimit = 10000

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string, requestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("logs.user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("logs.user_id = ? and logs.type = ?", userId, logType)
	}

	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return nil, 0, err
		}
		tx = tx.Where("logs.model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
	}
	err = tx.Model(&Log{}).Limit(logSearchCountLimit).Count(&total).Error
	if err != nil {
		common.SysError("failed to count user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		common.SysError("failed to search user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}

	formatUserLogs(logs, startIdx)
	return logs, total, err
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

// SumUsedQuota aggregates quota/rpm/tpm stats. When userWhitelist != nil, stats
// are restricted to logs whose user_id is in the whitelist.
func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string, userWhitelist []int) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if username != "" {
		tx = tx.Where("username = ?", username)
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
		rpmTpmQuery = rpmTpmQuery.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
		rpmTpmQuery = rpmTpmQuery.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
		rpmTpmQuery = rpmTpmQuery.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return stat, err
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
		rpmTpmQuery = rpmTpmQuery.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
		rpmTpmQuery = rpmTpmQuery.Where(logGroupCol+" = ?", group)
	}
	if userWhitelist != nil {
		tx = tx.Where("user_id IN ?", userWhitelist)
		rpmTpmQuery = rpmTpmQuery.Where("user_id IN ?", userWhitelist)
	}

	tx = tx.Where("type = ?", LogTypeConsume)
	rpmTpmQuery = rpmTpmQuery.Where("type = ?", LogTypeConsume)

	// 只统计最近60秒的rpm和tpm
	rpmTpmQuery = rpmTpmQuery.Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	// 执行查询
	if err := tx.Scan(&stat).Error; err != nil {
		common.SysError("failed to query log stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}
	if err := rpmTpmQuery.Scan(&stat).Error; err != nil {
		common.SysError("failed to query rpm/tpm stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}

	return stat, nil
}

func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64 = 0

	for {
		if nil != ctx.Err() {
			return total, ctx.Err()
		}

		result := LOG_DB.Where("created_at < ?", targetTimestamp).Limit(limit).Delete(&Log{})
		if nil != result.Error {
			return total, result.Error
		}

		total += result.RowsAffected

		if result.RowsAffected < int64(limit) {
			break
		}
	}

	return total, nil
}

type ChannelSuccessRate struct {
	ModelName    string  `json:"model_name"`
	ChannelId    int     `json:"channel_id"`
	ChannelName  string  `json:"channel_name"`
	ChannelStatus int   `json:"channel_status"`
	TotalCount   int64   `json:"total_count"`
	SuccessCount int64   `json:"success_count"`
	SuccessRate  float64 `json:"success_rate"`
}

func GetChannelSuccessRate(startTimestamp, endTimestamp int64) ([]ChannelSuccessRate, error) {
	type countResult struct {
		ModelName    string
		ChannelId    int
		ChannelName  string
		TotalCount   int64
		SuccessCount int64
	}

	var results []countResult
	err := LOG_DB.Table("logs").
		Select(`model_name, channel_id, channel_name, COUNT(*) AS total_count, SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_count`,
			LogTypeConsume).
		Where("type IN ? AND created_at >= ? AND created_at <= ?",
			[]int{LogTypeConsume, LogTypeError}, startTimestamp, endTimestamp).
		Group("model_name, channel_id, channel_name").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	channelIds := types.NewSet[int]()
	for _, r := range results {
		channelIds.Add(r.ChannelId)
	}
	channelNames := make(map[int]string, channelIds.Len())
	channelStatuses := make(map[int]int, channelIds.Len())
	channelSyncLock.RLock()
	for _, id := range channelIds.Items() {
		if ch, ok := channelsIDM[id]; ok {
			channelNames[id] = ch.Name
			channelStatuses[id] = ch.Status
		}
	}
	channelSyncLock.RUnlock()

	result := make([]ChannelSuccessRate, 0, len(results))
	for _, r := range results {
		chName := r.ChannelName
		chStatus := channelStatuses[r.ChannelId]
		if chName == "" {
			chName = channelNames[r.ChannelId]
		}

		var successRate float64
		if r.TotalCount > 0 {
			successRate = math.Round(float64(r.SuccessCount)/float64(r.TotalCount)*10000) / 100
		}

		result = append(result, ChannelSuccessRate{
			ModelName:     r.ModelName,
			ChannelId:     r.ChannelId,
			ChannelName:   chName,
			ChannelStatus: chStatus,
			TotalCount:    r.TotalCount,
			SuccessCount:  r.SuccessCount,
			SuccessRate:   successRate,
		})
	}

	return result, nil
}

// GroupSuccessRate is the per-group, per-model success-rate row returned by
// GetGroupSuccessRate. Aggregation key is (group, model_name) — not channel.
type GroupSuccessRate struct {
	Group         string  `json:"group"`
	ModelName     string  `json:"model_name"`
	TotalCount    int64   `json:"total_count"`
	SuccessCount  int64   `json:"success_count"`
	SuccessRate   float64 `json:"success_rate"`
}

// GetGroupSuccessRate aggregates consume/error logs by (group, model_name) within
// the given [start, end] timestamp window. This replaces the channel-centric view
// with a group-centric one ("分组模型成功率").
//
// Cross-DB note: logGroupCol quotes the reserved column name correctly across
// SQLite/MySQL (backtick) and PostgreSQL (double quote). The GROUP BY uses the
// raw column name via logGroupCol to stay portable.
func GetGroupSuccessRate(startTimestamp, endTimestamp int64) ([]GroupSuccessRate, error) {
	type countResult struct {
		Group        string
		ModelName    string
		TotalCount   int64
		SuccessCount int64
	}

	var results []countResult
	err := LOG_DB.Table("logs").
		Select(logGroupCol+", model_name, COUNT(*) AS total_count, SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_count",
			LogTypeConsume).
		Where("type IN ? AND created_at >= ? AND created_at <= ?",
			[]int{LogTypeConsume, LogTypeError}, startTimestamp, endTimestamp).
		Group(logGroupCol + ", model_name").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	out := make([]GroupSuccessRate, 0, len(results))
	for _, r := range results {
		var rate float64
		if r.TotalCount > 0 {
			rate = math.Round(float64(r.SuccessCount)/float64(r.TotalCount)*10000) / 100
		}
		group := r.Group
		if group == "" {
			group = "default"
		}
		out = append(out, GroupSuccessRate{
			Group:        group,
			ModelName:    r.ModelName,
			TotalCount:   r.TotalCount,
			SuccessCount: r.SuccessCount,
			SuccessRate:  rate,
		})
	}
	return out, nil
}
