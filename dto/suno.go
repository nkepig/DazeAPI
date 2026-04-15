package dto

import "encoding/json"

type SunoDataResponse struct {
	TaskID     string          `json:"task_id"`
	Status     string          `json:"status"`
	FailReason string          `json:"fail_reason"`
	SubmitTime int64           `json:"submit_time"`
	StartTime  int64           `json:"start_time"`
	FinishTime int64           `json:"finish_time"`
	Data       json.RawMessage `json:"data"`
}

type SunoSubmitReq struct {
	Mv     string `json:"mv"`
	Prompt string `json:"prompt"`
}
