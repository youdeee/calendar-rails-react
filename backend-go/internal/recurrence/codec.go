package recurrence

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

type Rule struct {
	Frequency string
	Interval  int
	Until     string
}

var AllowedFrequencies = map[string]struct{}{
	"daily":   {},
	"weekly":  {},
	"monthly": {},
}

func Serialize(rule *Rule) (string, error) {
	if rule == nil {
		return "", nil
	}
	body := map[string]any{
		"frequency": rule.Frequency,
		"interval":  rule.Interval,
	}
	if rule.Until != "" {
		body["until"] = rule.Until
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func Deserialize(raw string) (*Rule, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(raw), &body); err != nil {
		return nil, err
	}
	interval, err := coerceInterval(body["interval"])
	if err != nil {
		return nil, err
	}
	until := ""
	if v, ok := body["until"]; ok && v != nil {
		until = stringify(v)
	}
	return &Rule{
		Frequency: stringify(body["frequency"]),
		Interval:  interval,
		Until:     until,
	}, nil
}

func coerceInterval(v any) (int, error) {
	switch n := v.(type) {
	case nil:
		return 0, nil
	case float64:
		return int(n), nil
	case json.Number:
		i, err := n.Int64()
		return int(i), err
	case string:
		return strconv.Atoi(n)
	default:
		return strconv.Atoi(stringify(v))
	}
}

func stringify(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	b, _ := json.Marshal(v)
	return strings.Trim(string(b), `"`)
}

const maxOccurrences = 400

func EndOfUTCDay(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 23, 59, 59, 999999999, time.UTC)
}

func OccurrencesBetween(startAt, endAt, rangeStart, rangeEnd time.Time, rule *Rule) []time.Time {
	inclusiveRangeEnd := EndOfUTCDay(rangeEnd)
	duration := endAt.Sub(startAt)
	if rule == nil {
		if !startAt.After(inclusiveRangeEnd) && !endAt.Before(rangeStart) {
			return []time.Time{startAt}
		}
		return nil
	}

	var untilDate time.Time
	hasUntil := false
	if rule.Until != "" {
		parsed, err := time.Parse("2006-01-02", rule.Until)
		if err == nil {
			untilDate = parsed
			hasUntil = true
		}
	}

	occurrences := make([]time.Time, 0)
	cursor := startAt
	for safety := 0; !cursor.After(inclusiveRangeEnd) && safety < 10_000; safety++ {
		if hasUntil {
			cy, cm, cd := cursor.UTC().Date()
			cursorDay := time.Date(cy, cm, cd, 0, 0, 0, 0, time.UTC)
			if cursorDay.After(untilDate) {
				break
			}
		}
		occurrenceEnd := cursor.Add(duration)
		if !cursor.After(inclusiveRangeEnd) && !occurrenceEnd.Before(rangeStart) {
			occurrences = append(occurrences, cursor)
			if len(occurrences) >= maxOccurrences {
				break
			}
		}
		cursor = nextOccurrence(cursor, rule.Frequency, rule.Interval)
	}
	return occurrences
}

func nextOccurrence(cursor time.Time, frequency string, interval int) time.Time {
	c := cursor.In(time.UTC)
	switch frequency {
	case "daily":
		return c.AddDate(0, 0, interval)
	case "weekly":
		return c.AddDate(0, 0, 7*interval)
	case "monthly":
		return c.AddDate(0, interval, 0)
	default:
		return c.AddDate(0, 0, interval)
	}
}
