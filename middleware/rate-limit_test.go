package middleware

import "testing"

func TestSkipWebRateLimit(t *testing.T) {
	tests := []struct {
		path string
		skip bool
	}{
		{"/assets/index-DJpNzhdK.js", true},
		{"/assets/MarkdownRenderer-DmtEzsLx.css", true},
		{"/favicon.png", true},
		{"/logo.svg", true},
		{"/console/log", false},
		{"/console/permission", false},
		{"/", false},
		{"/docs", false},
		{"/index.html", false},
	}
	for _, tt := range tests {
		if got := skipWebRateLimit(tt.path); got != tt.skip {
			t.Errorf("skipWebRateLimit(%q) = %v, want %v", tt.path, got, tt.skip)
		}
	}
}
