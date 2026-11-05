/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package openaicompat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestChatCompletionsRequestToResponsesRequestPreservesReasoningEnabled(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:     "deepseek/deepseek-v4.1-flash-1017",
		Reasoning: json.RawMessage(`{"enabled":false}`),
	}

	converted, err := ChatCompletionsRequestToResponsesRequest(req)
	if err != nil {
		t.Fatalf("conversion returned error: %v", err)
	}
	if converted.Reasoning == nil {
		t.Fatal("expected reasoning options to be preserved")
	}
	if converted.Reasoning.Enabled == nil {
		t.Fatal("expected reasoning.enabled to be present")
	}
	if *converted.Reasoning.Enabled {
		t.Fatal("expected reasoning.enabled=false")
	}

	encoded, err := json.Marshal(converted)
	if err != nil {
		t.Fatalf("marshal converted request: %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("decode converted request: %v", err)
	}
	reasoning, ok := body["reasoning"].(map[string]any)
	if !ok || reasoning["enabled"] != false {
		t.Fatalf("converted request lost reasoning.enabled=false: %s", encoded)
	}
}
