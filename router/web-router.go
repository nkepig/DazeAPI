package router

import (
	"bytes"
	"embed"
	"html"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

var indexPageCache struct {
	sync.RWMutex
	title string
	data  []byte
}

func resolveIndexTitle() string {
	title := strings.TrimSpace(common.SystemName)
	if title == "" {
		return "API"
	}
	return title
}

func renderIndexPage(indexPage []byte) []byte {
	title := resolveIndexTitle()

	indexPageCache.RLock()
	if indexPageCache.title == title && indexPageCache.data != nil {
		cached := indexPageCache.data
		indexPageCache.RUnlock()
		return cached
	}
	indexPageCache.RUnlock()

	escapedTitle := []byte("<title>" + html.EscapeString(title) + "</title>")
	start := bytes.Index(indexPage, []byte("<title>"))
	if start == -1 {
		return indexPage
	}
	end := bytes.Index(indexPage[start:], []byte("</title>"))
	if end == -1 {
		return indexPage
	}
	end += start + len("</title>")
	rendered := make([]byte, 0, len(indexPage)-((end-start)-len(escapedTitle)))
	rendered = append(rendered, indexPage[:start]...)
	rendered = append(rendered, escapedTitle...)
	rendered = append(rendered, indexPage[end:]...)

	indexPageCache.Lock()
	indexPageCache.title = title
	indexPageCache.data = rendered
	indexPageCache.Unlock()

	return rendered
}

func renderDocsPage(data []byte) []byte {
	siteURL := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if siteURL == "" {
		return data
	}
	script := []byte("<script>window.SITE_URL=" + strconv.Quote(siteURL) + ";</script>")
	insertAt := bytes.Index(data, []byte("</head>"))
	if insertAt == -1 {
		rendered := make([]byte, 0, len(script)+len(data))
		rendered = append(rendered, script...)
		rendered = append(rendered, data...)
		return rendered
	}
	rendered := make([]byte, 0, len(data)+len(script))
	rendered = append(rendered, data[:insertAt]...)
	rendered = append(rendered, script...)
	rendered = append(rendered, data[insertAt:]...)
	return rendered
}

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	indexHandler := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", renderIndexPage(indexPage))
	}
	router.GET("/", indexHandler)
	router.GET("/index.html", indexHandler)

	// Explicitly serve /docs to avoid redirect loops caused by gin-contrib/static
	// directory detection on embedded FS (it would 301 /docs ↔ /docs/ indefinitely).
	docsHandler := func(c *gin.Context) {
		data, err := buildFS.ReadFile("web/dist/docs/index.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", renderDocsPage(data))
	}
	router.GET("/docs", docsHandler)
	router.GET("/docs/", docsHandler)
	router.GET("/docs/index.html", docsHandler)

	router.Use(static.Serve("/", common.EmbedFolder(buildFS, "web/dist")))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", renderIndexPage(indexPage))
	})
}
