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

	"github.com/gin-gonic/gin"
)

func GetClawdModels(c *gin.Context) {
	grouped := model.GetEnabledModelsGrouped()
	type modelItem struct {
		Group string `json:"group"`
		Model string `json:"model"`
		Label string `json:"label"`
	}
	items := make([]modelItem, 0, len(grouped))
	for _, g := range grouped {
		items = append(items, modelItem{
			Group: g.Group,
			Model: g.Model,
			Label: "[" + g.Group + "]" + g.Model,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
	})
}

func GetClawdScores(c *gin.Context) {
	cfg := operation_setting.GetClawdSetting()
	stats, err := service.ComputeChannelScores(int64(cfg.WatchIntervalSeconds))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type GroupResult struct {
		ClawdGroup     string                 `json:"clawd_group"`
		AvgUserRatio   float64                `json:"avg_user_ratio"`
		MaxProfit      float64                `json:"max_profit"`
		MaxSuccessRate float64                `json:"max_success_rate"`
		MinUseTime     float64                `json:"min_use_time"`
		Channels       []service.ChannelScore `json:"channels"`
	}

	out := make([]GroupResult, 0, len(stats))
	for cg, s := range stats {
		out = append(out, GroupResult{
			ClawdGroup:     cg,
			AvgUserRatio:   s.AvgUserRatio,
			MaxProfit:      s.MaxProfit,
			MaxSuccessRate: s.MaxSuccessRate,
			MinUseTime:     s.MinUseTime,
			Channels:       s.Channels,
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
		Id                 int     `json:"id"`
		Name               string  `json:"name"`
		Group              string  `json:"group"`
		ClawdGroup         string  `json:"clawd_group"`
		ClawdCostRatio     float64 `json:"clawd_cost_ratio"`
		Priority           int64   `json:"priority"`
		Weight             uint    `json:"weight"`
		ClawdScore         float64 `json:"clawd_score"`
		ClawdTuneReason    string  `json:"clawd_tune_reason"`
		ClawdLastTuneAt    int64   `json:"clawd_last_tune_at"`
		ClawdInObservation bool    `json:"clawd_in_observation"`
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
			ClawdGroup:         ch.ChannelInfo.ClawdGroup.String(),
			ClawdCostRatio:     ch.ChannelInfo.ClawdCostRatio,
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
		Group     string  `json:"group"`
		CostRatio float64 `json:"cost_ratio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	if err := model.SetChannelClawdGroup(channelId, req.Group, req.CostRatio); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func SetClawdCostRatio(c *gin.Context) {
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
		CostRatio float64 `json:"cost_ratio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	if err := model.SetChannelClawdCostRatio(channelId, req.CostRatio); err != nil {
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
		"data": gin.H{
		"enabled":                cfg.Enabled,
		"watch_interval_seconds": cfg.WatchIntervalSeconds,
		"min_sample_size":        cfg.MinSampleSize,
		"group_configs":          cfg.GroupConfigs,
		"observation_count":      cfg.ObservationCount,
		"observation_seconds":    cfg.ObservationSeconds,
		"agent_base_url":         cfg.AgentBaseURL,
		"agent_api_key":          cfg.AgentAPIKey,
		"agent_model":            cfg.AgentModel,
	},
	})
}

func UpdateClawdSetting(c *gin.Context) {
	var req struct {
		Enabled              *bool                        `json:"enabled"`
		MinSampleSize        *int                         `json:"min_sample_size"`
		WatchIntervalSeconds *int                         `json:"watch_interval_seconds"`
		GroupConfigs         *map[string]operation_setting.ClawdGroupConfig `json:"group_configs"`
		ObservationCount     *int                         `json:"observation_count"`
		ObservationSeconds   *int                         `json:"observation_seconds"`
		AgentBaseURL         *string                      `json:"agent_base_url"`
		AgentAPIKey          *string                      `json:"agent_api_key"`
		AgentModel           *string                      `json:"agent_model"`
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
	if req.GroupConfigs != nil {
		cfg.GroupConfigs = *req.GroupConfigs
		configJSON, _ := common.Marshal(cfg.GroupConfigs)
		if err := model.UpdateOption("clawd_setting.group_configs", string(configJSON)); err != nil {
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
	if req.AgentBaseURL != nil {
		cfg.AgentBaseURL = *req.AgentBaseURL
		if err := model.UpdateOption("clawd_setting.agent_base_url", *req.AgentBaseURL); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.AgentAPIKey != nil {
		cfg.AgentAPIKey = *req.AgentAPIKey
		if err := model.UpdateOption("clawd_setting.agent_api_key", *req.AgentAPIKey); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.AgentModel != nil {
		cfg.AgentModel = *req.AgentModel
		if err := model.UpdateOption("clawd_setting.agent_model", *req.AgentModel); err != nil {
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

func ClawdChatStream(c *gin.Context) {
	if c.GetInt("role") != common.RoleRootUser {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "现在嘛～只和主人说话哦٩(๑`^´๑)۶，心情好了自然会回来的，反正……先等着吧(・ω・)ノ✨",
		})
		return
	}
	var req struct {
		Message   string `json:"message"`
		SessionId string `json:"session_id"`
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

	sidecarURL := os.Getenv("CLAWD_SIDECAR_URL")
	if sidecarURL == "" {
		sidecarURL = "http://localhost:6000"
	}

	userId := c.GetInt("id")

	payload, _ := common.Marshal(gin.H{
		"message":    req.Message,
		"session_id": req.SessionId,
		"user_id":    fmt.Sprintf("uid-%d", userId),
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
