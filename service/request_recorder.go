package service

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type RecordingResponseWriter struct {
	gin.ResponseWriter
	Body bytes.Buffer
}

func (w *RecordingResponseWriter) Write(data []byte) (int, error) {
	_, _ = w.Body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *RecordingResponseWriter) WriteString(data string) (int, error) {
	_, _ = w.Body.WriteString(data)
	return w.ResponseWriter.WriteString(data)
}

type ChannelRequestRecord struct {
	Time         int64  `json:"time"`
	RequestId    string `json:"request_id"`
	Username     string `json:"username"`
	UserId       int    `json:"user_id"`
	ChannelId    int    `json:"channel_id"`
	ChannelName  string `json:"channel_name"`
	ModelName    string `json:"model_name"`
	Path         string `json:"path"`
	Method       string `json:"method"`
	StatusCode   int    `json:"status_code"`
	IsStream     bool   `json:"is_stream"`
	RetryIndex   int    `json:"retry_index"`
	Error        string `json:"error,omitempty"`
	RequestBody  string `json:"request_body"`
	ResponseBody string `json:"response_body"`
}

func RecordChannelRequest(record ChannelRequestRecord) {
	if err := writeChannelRequestRecord(record); err != nil {
		common.SysError("channel request record write error: " + err.Error())
	}
}

func writeChannelRequestRecord(record ChannelRequestRecord) error {
	dir := filepath.Join("/data/tmp", "record")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	filename := channelRequestRecordFilename(record)
	filePath := filepath.Join(dir, filename)
	line, err := common.Marshal(record)
	if err != nil {
		return err
	}
	line = append(line, '\n')
	if err := appendFileLine(filePath, line); err != nil {
		return err
	}
	common.SysLog("channel request record written: " + filePath)
	return nil
}

func appendFileLine(filePath string, data []byte) error {
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err = f.Write(data); err != nil {
		return err
	}
	return f.Sync()
}

func channelRequestRecordFilename(record ChannelRequestRecord) string {
	now := time.Unix(record.Time, 0)
	bucket := now.Format("200601021504")
	return fmt.Sprintf("%s_%d_%s_%s.jsonl", safeFilePart(record.Username), record.ChannelId, safeFilePart(record.ModelName), bucket)
}

func safeFilePart(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	var b strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	result := strings.Trim(b.String(), "_")
	if result == "" {
		return "unknown"
	}
	return result
}
