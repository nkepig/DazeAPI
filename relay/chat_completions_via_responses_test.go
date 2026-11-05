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

package relay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestPreserveExplicitReasoningDisabled(t *testing.T) {
	enabled := false
	request := &dto.GeneralOpenAIRequest{
		Reasoning: json.RawMessage(`{"enabled":false}`),
	}
	body, err := preserveExplicitReasoningDisabled(request, []byte(`{"model":"deepseek"}`))
	if err != nil {
		t.Fatalf("preserve disabled reasoning: %v", err)
	}
	if string(body) != `{"model":"deepseek","reasoning":{"enabled":false}}` {
		t.Fatalf("unexpected body: %s", body)
	}
	if reasoningIsExplicitlyDisabled(request) != !enabled {
		t.Fatal("expected explicit false to be detected")
	}
}

func TestPreserveExplicitReasoningDisabledLeavesEnabledRequestUnchanged(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Reasoning: json.RawMessage(`{"enabled":true}`),
	}
	input := []byte(`{"model":"deepseek"}`)
	body, err := preserveExplicitReasoningDisabled(request, input)
	if err != nil {
		t.Fatalf("preserve enabled reasoning: %v", err)
	}
	if string(body) != string(input) {
		t.Fatalf("unexpected body: %s", body)
	}
}
