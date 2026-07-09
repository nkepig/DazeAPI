package model

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// FlexString is a string type that can be unmarshaled from a JSON string or
// number. This exists to handle legacy data where certain fields (e.g.
// ChannelInfo.ClawdGroup) were persisted as numbers even though the Go struct
// field is a string.
//
// On unmarshal:
//   - JSON string  -> FlexString(value)
//   - JSON number  -> FlexString(number.String())
//   - JSON null    -> FlexString("")
//
// On marshal it behaves identically to a regular string, so no downstream
// consumers (frontend, API responses) are affected.
type FlexString string

// String returns the underlying string value.
func (f FlexString) String() string {
	return string(f)
}

// UnmarshalJSON implements json.Unmarshaler so that both string and number
// JSON values are accepted.
func (f *FlexString) UnmarshalJSON(data []byte) error {
	// Handle JSON null.
	if string(data) == "null" {
		*f = ""
		return nil
	}

	// Try string first — the common case.
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*f = FlexString(s)
		return nil
	}

	// Try number — legacy data may store the value as a numeric literal.
	var n json.Number
	if err := json.Unmarshal(data, &n); err == nil {
		// json.Number.String() preserves the original textual representation,
		// but we normalize integers to avoid leading zeros / trailing .0.
		if intVal, err := strconv.ParseInt(n.String(), 10, 64); err == nil {
			*f = FlexString(strconv.FormatInt(intVal, 10))
			return nil
		}
		if floatVal, err := strconv.ParseFloat(n.String(), 64); err == nil {
			*f = FlexString(strconv.FormatFloat(floatVal, 'f', -1, 64))
			return nil
		}
		*f = FlexString(n.String())
		return nil
	}

	return fmt.Errorf("FlexString: cannot unmarshal %s into FlexString", string(data))
}

// IsEmpty reports whether the FlexString is the empty string.
func (f FlexString) IsEmpty() bool {
	return f == ""
}
