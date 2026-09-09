package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/event"
)

func (s *Server) listEvents(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "invalid date: ")
		return
	}
	items, err := s.events.List(r.Context(), userFrom(r.Context()), from, to)
	if err != nil {
		handleErr(w, err)
		return
	}
	out := make([]eventJSON, 0, len(items))
	for _, item := range items {
		out = append(out, toEventJSON(item))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createEvent(w http.ResponseWriter, r *http.Request) {
	in, err := decodeCreate(r)
	if err != nil {
		writeEventDecodeError(w, err)
		return
	}
	item, err := s.events.Create(r.Context(), userFrom(r.Context()), in)
	if err != nil {
		handleErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toEventJSON(item))
}

func (s *Server) updateEvent(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	in, err := decodeUpdate(r)
	if err != nil {
		writeEventDecodeError(w, err)
		return
	}
	item, err := s.events.Update(r.Context(), userFrom(r.Context()), id, in)
	if err != nil {
		handleErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toEventJSON(item))
}

func (s *Server) deleteEvent(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "Not Found")
		return
	}
	if err := s.events.Delete(r.Context(), userFrom(r.Context()), id); err != nil {
		handleErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeCreate(r *http.Request) (event.CreateInput, error) {
	fields, err := decodeEventWrapper(r)
	if err != nil {
		return event.CreateInput{}, err
	}
	in := event.CreateInput{}
	if title, ok := fields["title"]; ok {
		s, err := unmarshalString(title)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.Title = &s
	}
	if desc, ok := fields["description"]; ok {
		s, err := unmarshalStringPtr(desc)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.Description = s
	}
	if v, ok := fields["start_at"]; ok {
		t, err := unmarshalTime(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.StartAt = t
	}
	if v, ok := fields["end_at"]; ok {
		t, err := unmarshalTime(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.EndAt = t
	}
	if v, ok := fields["all_day"]; ok {
		b, err := unmarshalBool(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.AllDay = &b
	}
	if v, ok := fields["start_on"]; ok {
		t, err := unmarshalDate(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.StartOn = t
	}
	if v, ok := fields["end_on"]; ok {
		t, err := unmarshalDate(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.EndOn = t
	}
	if v, ok := fields["reminder_minutes"]; ok {
		n, err := unmarshalInt32Ptr(v)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.ReminderMinutes = n
	}
	if recRaw, ok := fields["recurrence"]; ok {
		rec, err := parseRecurrenceRaw(recRaw)
		if err != nil {
			return event.CreateInput{}, err
		}
		in.Recurrence = toRecurrenceParams(rec)
	}
	return in, nil
}

func decodeUpdate(r *http.Request) (event.UpdateInput, error) {
	fields, err := decodeEventWrapper(r)
	if err != nil {
		return event.UpdateInput{}, err
	}
	in := event.UpdateInput{}
	if title, ok := fields["title"]; ok {
		s, err := unmarshalString(title)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.Title = &s
	}
	if desc, ok := fields["description"]; ok {
		s, err := unmarshalStringPtr(desc)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.Description = s
	}
	if v, ok := fields["start_at"]; ok {
		t, err := unmarshalTime(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.StartAt = t
	}
	if v, ok := fields["end_at"]; ok {
		t, err := unmarshalTime(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.EndAt = t
	}
	if v, ok := fields["all_day"]; ok {
		b, err := unmarshalBool(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.AllDay = &b
	}
	if v, ok := fields["start_on"]; ok {
		t, err := unmarshalDate(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.StartOn = t
	}
	if v, ok := fields["end_on"]; ok {
		t, err := unmarshalDate(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.EndOn = t
	}
	if v, ok := fields["reminder_minutes"]; ok {
		n, err := unmarshalInt32Ptr(v)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.ReminderMinutesSpecified = true
		in.ReminderMinutes = n
	}
	if recRaw, ok := fields["recurrence"]; ok {
		rec, err := parseRecurrenceRaw(recRaw)
		if err != nil {
			return event.UpdateInput{}, err
		}
		in.RecurrenceSpecified = true
		in.Recurrence = toRecurrenceParams(rec)
	}
	return in, nil
}

func decodeEventWrapper(r *http.Request) (map[string]json.RawMessage, error) {
	var wrapper struct {
		Event json.RawMessage `json:"event"`
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&wrapper); err != nil {
		if err == io.EOF {
			return nil, eventBadRequest("param is missing or the value is empty: event")
		}
		return nil, eventBadRequest("invalid request")
	}
	if len(wrapper.Event) == 0 || string(wrapper.Event) == "null" {
		return nil, eventBadRequest("param is missing or the value is empty: event")
	}
	fields := map[string]json.RawMessage{}
	if err := json.Unmarshal(wrapper.Event, &fields); err != nil {
		return nil, eventBadRequest("invalid request")
	}
	return fields, nil
}

func writeEventDecodeError(w http.ResponseWriter, err error) {
	var bad eventBadRequest
	if errors.As(err, &bad) {
		writeError(w, http.StatusBadRequest, bad.Error())
		return
	}
	writeError(w, http.StatusBadRequest, "invalid request")
}

func toRecurrenceParams(rec *recurrenceJSON) *event.RecurrenceParams {
	if rec == nil {
		return nil
	}
	return &event.RecurrenceParams{
		Frequency: rec.Frequency,
		Interval:  int(rec.Interval),
		Until:     rec.Until,
	}
}

func toEventJSON(item event.EventResponse) eventJSON {
	var rec *recurrenceJSON
	if item.Recurrence != nil {
		rec = &recurrenceJSON{
			Frequency: item.Recurrence.Frequency,
			Interval:  flexInt(item.Recurrence.Interval),
			Until:     item.Recurrence.Until,
		}
	}
	return eventJSON{
		ID:              item.ID,
		Title:           item.Title,
		Description:     item.Description,
		StartAt:         item.StartAt,
		EndAt:           item.EndAt,
		StartOn:         item.StartOn,
		EndOn:           item.EndOn,
		AllDay:          item.AllDay,
		ReminderMinutes: item.ReminderMinutes,
		Recurring:       item.Recurring,
		Recurrence:      rec,
	}
}

func unmarshalString(raw json.RawMessage) (string, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", eventBadRequest("invalid request")
	}
	return s, nil
}

func unmarshalStringPtr(raw json.RawMessage) (*string, error) {
	if string(raw) == "null" {
		var empty string
		return &empty, nil
	}
	s, err := unmarshalString(raw)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func unmarshalBool(raw json.RawMessage) (bool, error) {
	var b bool
	if err := json.Unmarshal(raw, &b); err != nil {
		return false, eventBadRequest("invalid request")
	}
	return b, nil
}

func unmarshalDate(raw json.RawMessage) (*time.Time, error) {
	if string(raw) == "null" {
		return nil, eventBadRequest("invalid request")
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, eventBadRequest("invalid request")
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, eventBadRequest("invalid request")
	}
	return &t, nil
}

func unmarshalInt32Ptr(raw json.RawMessage) (*int32, error) {
	if string(raw) == "null" {
		return nil, nil
	}
	if len(raw) > 0 && raw[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, eventBadRequest("invalid request")
		}
		if strings.TrimSpace(s) == "" {
			return nil, nil
		}
		n, err := strconv.Atoi(strings.TrimSpace(s))
		if err != nil {
			z := int32(0)
			return &z, nil
		}
		v := int32(n)
		return &v, nil
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err != nil {
		return nil, eventBadRequest("invalid request")
	}
	v := int32(n)
	return &v, nil
}

func unmarshalTime(raw json.RawMessage) (*time.Time, error) {
	if string(raw) == "null" {
		return nil, eventBadRequest("invalid request")
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, eventBadRequest("invalid request")
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return &t, nil
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return &t, nil
	}
	return nil, eventBadRequest("invalid request")
}
