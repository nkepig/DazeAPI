package service

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

type ImageConvertMode int

const (
	ConvertImageDisabled ImageConvertMode = iota
	ConvertBase64ToURL
	ConvertURLToBase64
)

var imageBase64Regex = regexp.MustCompile(`^data:image/([a-zA-Z0-9]+);base64,([A-Za-z0-9+/=]+)$`)

const imageProxyRetention = 24 * time.Hour

func getImageCacheDir() string {
	return "/data/new-api-image-cache"
}

// TransformResponseImages recursively scans a JSON response body and replaces image references.
func TransformResponseImages(body []byte, mode ImageConvertMode, baseURL string) []byte {
	if mode == ConvertImageDisabled || baseURL == "" {
		return body
	}
	var data map[string]interface{}
	if err := common.Unmarshal(body, &data); err != nil {
		return body
	}
	transformValue(data, mode, baseURL)
	out, err := common.Marshal(data)
	if err != nil {
		return body
	}
	return out
}

func transformValue(v interface{}, mode ImageConvertMode, baseURL string) {
	switch val := v.(type) {
	case map[string]interface{}:
		keyReplacements := make(map[string]string)
		for k, item := range val {
			if s, ok := item.(string); ok {
				if replaced := convertString(s, k, mode, baseURL); replaced != s {
					val[k] = replaced
					if mode == ConvertBase64ToURL && k == "b64_json" {
						keyReplacements[k] = "url"
					} else if mode == ConvertURLToBase64 && k == "url" {
						keyReplacements[k] = "b64_json"
					}
					continue
				}
			}
			transformValue(item, mode, baseURL)
		}
		for oldKey, newKey := range keyReplacements {
			if _, exists := val[newKey]; !exists {
				val[newKey] = val[oldKey]
			}
			delete(val, oldKey)
		}
	case []interface{}:
		for i, item := range val {
			if s, ok := item.(string); ok {
				if replaced := convertString(s, "", mode, baseURL); replaced != s {
					val[i] = replaced
					continue
				}
			}
			transformValue(item, mode, baseURL)
		}
	}
}

func convertString(str string, key string, mode ImageConvertMode, baseURL string) string {
	if mode == ConvertBase64ToURL {
		// First try data URI format: data:image/png;base64,iVBOR...
		matches := imageBase64Regex.FindStringSubmatch(str)
		if len(matches) == 3 {
			mime := "image/" + matches[1]
			b64Data := matches[2]
			hash := hashBase64(b64Data)
			_ = saveBase64ToDisk(hash, b64Data, mime)
			url := baseURL + "/v1/images/" + hash
			return url
		}
		// Raw base64 under "b64_json" key: decode, detect MIME, save, return URL
		if key == "b64_json" {
			decoded, err := base64.StdEncoding.DecodeString(str)
			if err == nil {
				contentType := http.DetectContentType(decoded)
				if strings.HasPrefix(contentType, "image/") {
					b64Data := str
					hash := hashBase64(b64Data)
					_ = saveBase64ToDisk(hash, b64Data, contentType)
					return baseURL + "/v1/images/" + hash
				}
			}
		}
		return str
	}
	if mode == ConvertURLToBase64 {
		if !strings.HasPrefix(str, "http") {
			return str
		}
		mime, b64Data, err := GetImageFromUrl(str)
		if err != nil {
			return str
		}
		return fmt.Sprintf("data:%s;base64,%s", mime, b64Data)
	}
	return str
}

func GetRequestBaseURL(c *gin.Context) string {
	if configured := system_setting.ServerAddress; configured != "" && configured != "http://localhost:3000" {
		return strings.TrimSuffix(configured, "/")
	}
	req := c.Request
	scheme := req.URL.Scheme
	if scheme == "" {
		scheme = "http"
		if req.TLS != nil {
			scheme = "https"
		}
		if proto := req.Header.Get("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		}
	}
	host := req.Host
	if host == "" {
		host = req.URL.Host
	}
	return scheme + "://" + host
}

func hashBase64(data string) string {
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])[:32]
}

func saveBase64ToDisk(hash, b64Data, mime string) error {
	dir := getImageCacheDir()
	_ = os.MkdirAll(dir, 0755)
	filePath := filepath.Join(dir, hash+".img")
	if _, err := os.Stat(filePath); err == nil {
		return nil
	}
	decoded, err := base64.StdEncoding.DecodeString(b64Data)
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, decoded, 0644)
}

func cleanupExpiredImageProxyFiles(maxAge time.Duration) error {
	dir := getImageCacheDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	now := time.Now()
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".img" {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) > maxAge {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}
	return nil
}

func StartImageProxyCleanupTask() {
	gopool.Go(func() {
		_ = cleanupExpiredImageProxyFiles(imageProxyRetention)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := cleanupExpiredImageProxyFiles(imageProxyRetention); err != nil {
				common.SysError("image proxy cleanup error: " + err.Error())
			}
		}
	})
}

var imageHashRegex = regexp.MustCompile(`^[a-fA-F0-9]{32}$`)

// ServeImageProxy reads a cached image from disk and returns it with proper Content-Type.
func ServeImageProxy(c http.ResponseWriter, hash string) {
	if !imageHashRegex.MatchString(hash) {
		http.Error(c, "invalid hash", http.StatusBadRequest)
		return
	}
	filePath := filepath.Join(getImageCacheDir(), hash+".img")
	data, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(c, "image not found", http.StatusNotFound)
		return
	}
	contentType := http.DetectContentType(data)
	if contentType == "" {
		contentType = "image/png"
	}
	c.Header().Set("Content-Type", contentType)
	c.Header().Set("Cache-Control", "public, max-age=86400")
	c.WriteHeader(http.StatusOK)
	_, _ = c.Write(data)
}
