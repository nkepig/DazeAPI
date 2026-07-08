package controller

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func GetClawdModels(c *gin.Context) {
	models := model.GetEnabledModels()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
}

func GetClawdScores(c *gin.Context) {
	cfg := operation_setting.GetClawdSetting()
	stats, err := service.ComputeChannelScores(int64(cfg.WindowSeconds))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type GroupResult struct {
		ClawdGroup         int                             `json:"clawd_group"`
		MedianSuccessRate  float64                         `json:"median_success_rate"`
		MedianUseTime      float64                         `json:"median_use_time"`
		Channels           []service.ChannelScore          `json:"channels"`
	}

	out := make([]GroupResult, 0, len(stats))
	for cg, s := range stats {
		out = append(out, GroupResult{
			ClawdGroup:        cg,
			MedianSuccessRate: s.MedianSuccessRate,
			MedianUseTime:     s.MedianUseTime,
			Channels:          s.Channels,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    out,
	})
}

func GetClawdWatchedChannels(c *gin.Context) {
	channels, err := model.GetWatchedChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type WatchedItem struct {
		Id               int     `json:"id"`
		Name             string  `json:"name"`
		Group            string  `json:"group"`
		ClawdGroup       int     `json:"clawd_group"`
		Priority         int64   `json:"priority"`
		Weight           uint    `json:"weight"`
		ClawdScore       float64 `json:"clawd_score"`
		ClawdTuneReason  string  `json:"clawd_tune_reason"`
		ClawdLastTuneAt  int64   `json:"clawd_last_tune_at"`
		ClawdInObservation bool  `json:"clawd_in_observation"`
	}

	items := make([]WatchedItem, 0, len(channels))
	for _, ch := range channels {
		var weight uint = 0
		if ch.Weight != nil {
			weight = *ch.Weight
		}
		items = append(items, WatchedItem{
			Id:                 ch.Id,
			Name:               ch.Name,
			Group:              ch.Group,
			ClawdGroup:         ch.ChannelInfo.ClawdGroup,
			Priority:           ch.GetPriority(),
			Weight:             weight,
			ClawdScore:         ch.ChannelInfo.ClawdScore,
			ClawdTuneReason:    ch.ChannelInfo.ClawdTuneReason,
			ClawdLastTuneAt:    ch.ChannelInfo.ClawdLastTuneAt,
			ClawdInObservation: ch.ChannelInfo.ClawdInObservation,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
	})
}

func SetClawdWatched(c *gin.Context) {
	channelIdStr := c.Param("id")
	channelId, err := strconv.Atoi(channelIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid channel id",
		})
		return
	}

	var req struct {
		Group int `json:"group"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}
	if req.Group < 0 || req.Group > 3 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "group must be 0, 1, 2, or 3",
		})
		return
	}

	if err := model.SetChannelClawdGroup(channelId, req.Group); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func GetClawdTuneEvents(c *gin.Context) {
	channelIdStr := c.Query("channel_id")
	channelId, _ := strconv.Atoi(channelIdStr)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	events, total, err := model.GetChannelTuneEvents(channelId, limit, offset)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"events": events,
			"total":  total,
		},
	})
}

func ClawdTuneEventStream(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "streaming not supported",
		})
		return
	}

	fmt.Fprintf(c.Writer, "event: hello\ndata: {\"connected\":true}\n\n")
	flusher.Flush()

	bus := service.GetClawdEventBus()
	eventChan := bus.Subscribe()
	defer bus.Unsubscribe(eventChan)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	ctx := c.Request.Context()
	for {
		select {
		case event, ok := <-eventChan:
			if !ok {
				return
			}
			data, _ := common.Marshal(event)
			fmt.Fprintf(c.Writer, "event: tune\ndata: %s\n\n", string(data))
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(c.Writer, ": ping\n\n")
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

func GetClawdSetting(c *gin.Context) {
	cfg := operation_setting.GetClawdSetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cfg,
	})
}

func UpdateClawdSetting(c *gin.Context) {
	var req struct {
		Enabled              *bool    `json:"enabled"`
		WindowSeconds        *int     `json:"window_seconds"`
		MinSampleSize        *int     `json:"min_sample_size"`
		WatchIntervalSeconds *int     `json:"watch_interval_seconds"`
		SuccessRateRatio     *float64 `json:"success_rate_ratio"`
		LatencyMultiplier    *float64 `json:"latency_multiplier"`
		ObservationCount     *int     `json:"observation_count"`
		ObservationSeconds   *int     `json:"observation_seconds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	cfg := operation_setting.GetClawdSetting()

	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
		if err := model.UpdateOption("clawd_setting.enabled", strconv.FormatBool(*req.Enabled)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.WindowSeconds != nil && *req.WindowSeconds >= 60 {
		cfg.WindowSeconds = *req.WindowSeconds
		if err := model.UpdateOption("clawd_setting.window_seconds", strconv.Itoa(*req.WindowSeconds)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.MinSampleSize != nil && *req.MinSampleSize > 0 {
		cfg.MinSampleSize = *req.MinSampleSize
		if err := model.UpdateOption("clawd_setting.min_sample_size", strconv.Itoa(*req.MinSampleSize)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.WatchIntervalSeconds != nil && *req.WatchIntervalSeconds >= 60 {
		cfg.WatchIntervalSeconds = *req.WatchIntervalSeconds
		if err := model.UpdateOption("clawd_setting.watch_interval_seconds", strconv.Itoa(*req.WatchIntervalSeconds)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.SuccessRateRatio != nil && *req.SuccessRateRatio > 0 {
		cfg.SuccessRateRatio = *req.SuccessRateRatio
		if err := model.UpdateOption("clawd_setting.success_rate_ratio", strconv.FormatFloat(*req.SuccessRateRatio, 'f', -1, 64)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.LatencyMultiplier != nil && *req.LatencyMultiplier > 0 {
		cfg.LatencyMultiplier = *req.LatencyMultiplier
		if err := model.UpdateOption("clawd_setting.latency_multiplier", strconv.FormatFloat(*req.LatencyMultiplier, 'f', -1, 64)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.ObservationCount != nil && *req.ObservationCount > 0 {
		cfg.ObservationCount = *req.ObservationCount
		if err := model.UpdateOption("clawd_setting.observation_count", strconv.Itoa(*req.ObservationCount)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.ObservationSeconds != nil && *req.ObservationSeconds > 0 {
		cfg.ObservationSeconds = *req.ObservationSeconds
		if err := model.UpdateOption("clawd_setting.observation_seconds", strconv.Itoa(*req.ObservationSeconds)); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cfg,
	})
}

func ResetClawdBaseline(c *gin.Context) {
	if err := model.ClearAllChannelTuneEvents(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ResetAllWatchedChannelBaseline(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "已清空调整记录, 当前 priority 作为新基线",
	})
}

func resolveAgentCredentials() (baseURL string, apiKey string, err error) {
	newAPIURL := os.Getenv("CLAWD_NEW_API_URL")
	if newAPIURL == "" {
		newAPIURL = system_setting.ServerAddress + "/v1"
	}

	rootUser := model.GetRootUser()
	if rootUser == nil || rootUser.Id == 0 {
		return "", "", fmt.Errorf("no root user found in database")
	}

	var token model.Token
	err = model.DB.Where("user_id = ? AND status = ?", rootUser.Id, common.TokenStatusEnabled).
		Order("id desc").First(&token).Error
	if err != nil {
		return "", "", fmt.Errorf("no active token for root user: %v (please create a token in the dashboard)", err)
	}

	return newAPIURL, token.Key, nil
}

func ClawdChat(c *gin.Context) {
	var req struct {
		Message   string `json:"message"`
		SessionId string `json:"session_id"`
		Model     string `json:"model"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "message is required",
		})
		return
	}
	if req.SessionId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "session_id is required",
		})
		return
	}
	if req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	baseURL, apiKey, err := resolveAgentCredentials()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	sidecarURL := os.Getenv("CLAWD_SIDECAR_URL")
	if sidecarURL == "" {
		sidecarURL = "http://localhost:6000"
	}

	userId := c.GetInt("id")
	lang := c.GetString("lang")

	payload, _ := common.Marshal(gin.H{
		"message":    req.Message,
		"session_id": req.SessionId,
		"user_id":    fmt.Sprintf("uid-%d", userId),
		"base_url":   baseURL,
		"api_key":    apiKey,
		"model":      req.Model,
		"lang":       lang,
	})

	httpClient := &http.Client{Timeout: 120 * time.Second}
	resp, err := httpClient.Post(
		sidecarURL+"/chat",
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		common.SysLog("clawd chat sidecar error: " + err.Error())
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "agent sidecar unavailable: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

func ClawdChatStream(c *gin.Context) {
	var req struct {
		Message   string `json:"message"`
		SessionId string `json:"session_id"`
		Model     string `json:"model"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "message is required",
		})
		return
	}
	if req.SessionId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "session_id is required",
		})
		return
	}
	if req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	baseURL, apiKey, err := resolveAgentCredentials()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	sidecarURL := os.Getenv("CLAWD_SIDECAR_URL")
	if sidecarURL == "" {
		sidecarURL = "http://localhost:6000"
	}

	userId := c.GetInt("id")
	lang := c.GetString("lang")

	payload, _ := common.Marshal(gin.H{
		"message":    req.Message,
		"session_id": req.SessionId,
		"user_id":    fmt.Sprintf("uid-%d", userId),
		"base_url":   baseURL,
		"api_key":    apiKey,
		"model":      req.Model,
		"lang":       lang,
	})

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "streaming not supported",
		})
		return
	}

	httpClient := &http.Client{Timeout: 300 * time.Second}
	resp, err := httpClient.Post(
		sidecarURL+"/chat/stream",
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		common.SysLog("clawd chat stream sidecar error: " + err.Error())
		fmt.Fprintf(c.Writer, "data: {\"type\":\"error\",\"content\":\"agent sidecar unavailable: %s\"}\n\n", err.Error())
		flusher.Flush()
		fmt.Fprintf(c.Writer, "data: {\"type\":\"done\"}\n\n")
		flusher.Flush()
		return
	}
	defer resp.Body.Close()

	ctx := c.Request.Context()
	reader := bufio.NewReader(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err != io.EOF {
				common.SysLog("clawd chat stream read error: " + err.Error())
			}
			break
		}

		c.Writer.Write(line)
		flusher.Flush()
	}
}
