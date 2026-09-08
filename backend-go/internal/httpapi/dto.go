package httpapi

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

type flexInt int

func (f *flexInt) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		return nil
	}
	if len(b) > 0 && b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		if strings.TrimSpace(s) == "" {
			return nil
		}
		n, err := strconv.Atoi(strings.TrimSpace(s))
		if err != nil {
			*f = 0
			return nil
		}
		*f = flexInt(n)
		return nil
	}
	var n float64
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	*f = flexInt(int(n))
	return nil
}

type recurrenceJSON struct {
	Frequency string  `json:"frequency"`
	Interval  flexInt `json:"interval"`
	Until     *string `json:"until"`
}

type eventJSON struct {
	ID          int64           `json:"id"`
	Title       string          `json:"title"`
	Description *string         `json:"description"`
	StartAt     time.Time       `json:"start_at"`
	EndAt       time.Time       `json:"end_at"`
	AllDay      bool            `json:"all_day"`
	Recurring   bool            `json:"recurring"`
	Recurrence  *recurrenceJSON `json:"recurrence"`
}

type userJSON struct {
	ID        int64   `json:"id"`
	Email     string  `json:"email"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url"`
}

type authJSON struct {
	AccessToken string   `json:"access_token"`
	User        userJSON `json:"user"`
}

func parseRecurrenceRaw(raw json.RawMessage) (*recurrenceJSON, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	trimmed := strings.TrimSpace(string(raw))
	if !strings.HasPrefix(trimmed, "{") {
		return nil, eventBadRequest("recurrence must be an object")
	}
	var rec recurrenceJSON
	if err := json.Unmarshal(raw, &rec); err != nil {
		return nil, eventBadRequest("invalid request")
	}
	return &rec, nil
}

type eventBadRequest string

func (e eventBadRequest) Error() string { return string(e) }
