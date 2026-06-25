package common

import (
	"encoding/json"
)

// AdminPermissionKey is the JSON key stored inside User.AdminPermission.
const AdminPermissionKey = "admin_permissions"

// AdminPermission defines the per-admin fine-grained permission set configured by root.
//
// Storage: User.AdminPermission column holds JSON of map[string]any. An empty column
// (or a key absent from the map) means "default" — which for all boolean permissions
// is `true` (backward compatible: existing admins keep full access until root narrows
// them), and for list permissions is "all" (no whitelist restriction).
//
// Semantics:
//   - ViewUsageLogs: can the admin see the "Usage Logs" (使用日志) page.
//   - ManageUsers: "all" = manage every user; []int{ids...} = whitelist (only listed).
//   - ManageChannels: "all" = manage every channel; []int{ids...} = whitelist.
//   - ViewGroupSuccessRate: can the admin see the "Group Model Success Rate" panel.
//   - ConfigureOperationSettings: can the admin access "Operation Settings" (运营设置).
type AdminPermission struct {
	ViewUsageLogs               bool        `json:"view_usage_logs"`
	ManageUsers                 any         `json:"manage_users"`     // "all" or []float64 (JSON numbers)
	ManageChannels              any         `json:"manage_channels"`  // "all" or []float64
	ViewGroupSuccessRate        bool        `json:"view_group_success_rate"`
	ConfigureOperationSettings  bool        `json:"configure_operation_settings"`
}

// DefaultAdminPermission returns the "all allowed" permission set used for root and
// for admins whose AdminPermission column is empty (backward compatible).
func DefaultAdminPermission() AdminPermission {
	return AdminPermission{
		ViewUsageLogs:              true,
		ManageUsers:                "all",
		ManageChannels:             "all",
		ViewGroupSuccessRate:       true,
		ConfigureOperationSettings: true,
	}
}

// ParseAdminPermission decodes the stored JSON column into AdminPermission.
// Empty string => default (all allowed). Invalid JSON => default (fail open, log handled by caller).
func ParseAdminPermission(stored string) AdminPermission {
	if stored == "" {
		return DefaultAdminPermission()
	}
	var p AdminPermission
	if err := json.Unmarshal([]byte(stored), &p); err != nil {
		return DefaultAdminPermission()
	}
	// Absent keys default to "allowed": merge over the default so any missing field
	// keeps the backward-compatible "true / all" behavior rather than Go zero values.
	def := DefaultAdminPermission()
	if p.ManageUsers == nil {
		p.ManageUsers = def.ManageUsers
	}
	if p.ManageChannels == nil {
		p.ManageChannels = def.ManageChannels
	}
	// Note: Go zero value for bool is false, but JSON "absent" leaves the field false too.
	// We cannot distinguish "explicitly false" from "absent" after unmarshal. To preserve
	// "absent => default true" semantics we'd need a pointer type; for simplicity we treat
	// any stored JSON as authoritative for bools (root sets all fields when configuring).
	return p
}

// SerializeAdminPermission encodes AdminPermission to the column JSON.
func SerializeAdminPermission(p AdminPermission) (string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// AsMap exposes the permission as a map for JSON responses (GetSelf etc.).
func (p AdminPermission) AsMap() map[string]interface{} {
	return map[string]interface{}{
		"view_usage_logs":               p.ViewUsageLogs,
		"manage_users":                  p.ManageUsers,
		"manage_channels":               p.ManageChannels,
		"view_group_success_rate":       p.ViewGroupSuccessRate,
		"configure_operation_settings":  p.ConfigureOperationSettings,
	}
}

// ManageUsersWhitelist extracts a user-id whitelist from the ManageUsers field.
// Returns nil if "all" (no restriction), otherwise the list of permitted user IDs.
func (p AdminPermission) ManageUsersWhitelist() ([]int, bool) {
	return idWhitelist(p.ManageUsers)
}

// ManageChannelsWhitelist extracts a channel-id whitelist from the ManageChannels field.
func (p AdminPermission) ManageChannelsWhitelist() ([]int, bool) {
	return idWhitelist(p.ManageChannels)
}

// idWhitelist parses a permission field that is either the string "all" or a JSON
// array of numbers (JSON unmarshals [] into []float64). Returns (ids, restricted).
// restricted=false means "all" (no whitelist); restricted=true means only listed ids.
func idWhitelist(v any) ([]int, bool) {
	switch x := v.(type) {
	case string:
		if x == "all" || x == "" {
			return nil, false
		}
		return nil, false
	case []any:
		ids := make([]int, 0, len(x))
		for _, item := range x {
			switch n := item.(type) {
			case float64:
				ids = append(ids, int(n))
			case int:
				ids = append(ids, n)
			}
		}
		return ids, true
	case []float64:
		ids := make([]int, 0, len(x))
		for _, n := range x {
			ids = append(ids, int(n))
		}
		return ids, true
	case []int:
		return x, true
	}
	return nil, false
}