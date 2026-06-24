package dto

import (
	"encoding/json"
	"strconv"
)

// FlexString is a string that accepts either a JSON string or any other
// JSON value (object, array, number, boolean, null) during unmarshal.
// Non-string JSON values are normalized to their compact JSON string
// representation, so the field always exposes a string to consumers.
//
// This exists to handle upstream providers that return fields normally
// encoded as a JSON string (e.g. OpenAI Responses API `function_call`
// `arguments`) as a raw JSON object instead. Without it, the surrounding
// struct unmarshal fails and downstream usage/billing extraction is lost.
type FlexString string

func (s *FlexString) UnmarshalJSON(data []byte) error {
	// Fast path: JSON string.
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		*s = FlexString(str)
		return nil
	}
	// Fallback: any other JSON value. Normalize to compact JSON text so
	// downstream consumers that treat the field as a string keep working.
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if raw == nil {
		// `null` => empty string, mirroring zero-value semantics.
		*s = ""
		return nil
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	*s = FlexString(b)
	return nil
}

func (s FlexString) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(s))
}

type IntValue int

func (i *IntValue) UnmarshalJSON(b []byte) error {
	var n int
	if err := json.Unmarshal(b, &n); err == nil {
		*i = IntValue(n)
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return err
	}
	*i = IntValue(v)
	return nil
}

func (i IntValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(int(i))
}

type BoolValue bool

func (b *BoolValue) UnmarshalJSON(data []byte) error {
	var boolean bool
	if err := json.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	if str == "true" {
		*b = BoolValue(true)
	} else if str == "false" {
		*b = BoolValue(false)
	} else {
		return json.Unmarshal(data, &boolean)
	}
	return nil
}
func (b BoolValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(bool(b))
}
