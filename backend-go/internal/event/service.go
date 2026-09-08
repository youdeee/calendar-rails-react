package event

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/auth"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
	"github.com/youdeee/calendar-rails-react/backend-go/internal/recurrence"
)

var ErrNotFound = errors.New("Not Found")

type APIError struct {
	Status  int
	Message string
}

func (e APIError) Error() string { return e.Message }

func badRequest(msg string) error    { return APIError{Status: 400, Message: msg} }
func unprocessable(msg string) error { return APIError{Status: 422, Message: msg} }

type RecurrenceParams struct {
	Frequency string
	Interval  int
	Until     *string
}

type EventResponse struct {
	ID          int64
	Title       string
	Description *string
	StartAt     time.Time
	EndAt       time.Time
	AllDay      bool
	Recurring   bool
	Recurrence  *RecurrenceParams
}

type CreateInput struct {
	Title       *string
	Description *string
	StartAt     *time.Time
	EndAt       *time.Time
	AllDay      *bool
	Recurrence  *RecurrenceParams
}

type UpdateInput struct {
	Title               *string
	Description         *string
	StartAt             *time.Time
	EndAt               *time.Time
	AllDay              *bool
	Recurrence          *RecurrenceParams
	RecurrenceSpecified bool
}

type Service struct {
	q *db.Queries
}

func NewService(q *db.Queries) *Service {
	return &Service{q: q}
}

func (s *Service) List(ctx context.Context, user auth.User, fromRaw, toRaw string) ([]EventResponse, error) {
	from, err := parseDate(fromRaw)
	if err != nil {
		return nil, err
	}
	to, err := parseDate(toRaw)
	if err != nil {
		return nil, err
	}
	if to.Before(from) {
		return nil, badRequest("to must be after from")
	}
	if to.After(from.UTC().AddDate(0, 3, 0)) {
		return nil, badRequest("range too large")
	}
	toBoundary := recurrence.EndOfUTCDay(to)
	rows, err := s.q.FindEventCandidates(ctx, db.FindEventCandidatesParams{
		UserID:     user.ID,
		RangeFrom:  from,
		ToBoundary: toBoundary,
	})
	if err != nil {
		return nil, err
	}
	out := make([]EventResponse, 0)
	for _, row := range rows {
		rule, err := decodeRule(row.RecurrenceRule)
		if err != nil {
			return nil, err
		}
		duration := row.EndAt.Sub(row.StartAt)
		for _, start := range recurrence.OccurrencesBetween(row.StartAt, row.EndAt, from, to, rule) {
			out = append(out, toResponse(row, rule, start, start.Add(duration)))
		}
	}
	return out, nil
}

func (s *Service) Create(ctx context.Context, user auth.User, in CreateInput) (EventResponse, error) {
	row := db.Event{
		UserID: user.ID,
		AllDay: in.AllDay != nil && *in.AllDay,
	}
	if in.Title != nil {
		row.Title = *in.Title
	}
	row.Description = in.Description
	if in.StartAt != nil {
		row.StartAt = in.StartAt.UTC()
	}
	if in.EndAt != nil {
		row.EndAt = in.EndAt.UTC()
	}
	if err := applyRecurrence(&row, true, in.Recurrence); err != nil {
		return EventResponse{}, err
	}
	if err := validate(row); err != nil {
		return EventResponse{}, err
	}
	now := time.Now().UTC()
	saved, err := s.q.InsertEvent(ctx, db.InsertEventParams{
		UserID:         row.UserID,
		Title:          row.Title,
		Description:    row.Description,
		StartAt:        row.StartAt,
		EndAt:          row.EndAt,
		AllDay:         row.AllDay,
		RecurrenceRule: row.RecurrenceRule,
		CreatedAt:      now,
		UpdatedAt:      now,
	})
	if err != nil {
		return EventResponse{}, err
	}
	rule, err := decodeRule(saved.RecurrenceRule)
	if err != nil {
		return EventResponse{}, err
	}
	return toResponse(saved, rule, saved.StartAt, saved.EndAt), nil
}

func (s *Service) Update(ctx context.Context, user auth.User, id int64, in UpdateInput) (EventResponse, error) {
	row, err := s.q.FindEventByIDAndUserID(ctx, db.FindEventByIDAndUserIDParams{ID: id, UserID: user.ID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return EventResponse{}, ErrNotFound
		}
		return EventResponse{}, err
	}
	if in.Title != nil {
		row.Title = *in.Title
	}
	if in.Description != nil {
		row.Description = in.Description
	}
	if in.StartAt != nil {
		row.StartAt = in.StartAt.UTC()
	}
	if in.EndAt != nil {
		row.EndAt = in.EndAt.UTC()
	}
	if in.AllDay != nil {
		row.AllDay = *in.AllDay
	}
	if in.RecurrenceSpecified {
		if err := applyRecurrence(&row, true, in.Recurrence); err != nil {
			return EventResponse{}, err
		}
	}
	if err := validate(row); err != nil {
		return EventResponse{}, err
	}
	saved, err := s.q.UpdateEvent(ctx, db.UpdateEventParams{
		ID:             row.ID,
		UserID:         row.UserID,
		Title:          row.Title,
		Description:    row.Description,
		StartAt:        row.StartAt,
		EndAt:          row.EndAt,
		AllDay:         row.AllDay,
		RecurrenceRule: row.RecurrenceRule,
		UpdatedAt:      time.Now().UTC(),
	})
	if err != nil {
		return EventResponse{}, err
	}
	rule, err := decodeRule(saved.RecurrenceRule)
	if err != nil {
		return EventResponse{}, err
	}
	return toResponse(saved, rule, saved.StartAt, saved.EndAt), nil
}

func (s *Service) Delete(ctx context.Context, user auth.User, id int64) error {
	n, err := s.q.DeleteEvent(ctx, db.DeleteEventParams{ID: id, UserID: user.ID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func applyRecurrence(row *db.Event, specified bool, params *RecurrenceParams) error {
	if !specified {
		return nil
	}
	if params == nil {
		row.RecurrenceRule = nil
		return nil
	}
	rule, err := toRule(params)
	if err != nil {
		return err
	}
	raw, err := recurrence.Serialize(rule)
	if err != nil {
		return err
	}
	row.RecurrenceRule = &raw
	return nil
}

func toRule(params *RecurrenceParams) (*recurrence.Rule, error) {
	until := ""
	if params.Until != nil {
		until = strings.TrimSpace(*params.Until)
	}
	rule := &recurrence.Rule{Frequency: params.Frequency, Interval: params.Interval, Until: until}
	if err := validateRecurrence(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func validate(row db.Event) error {
	var errs []string
	if strings.TrimSpace(row.Title) == "" {
		errs = append(errs, "Title can't be blank")
	} else if len(row.Title) > 200 {
		errs = append(errs, "Title is too long (maximum is 200 characters)")
	}
	if row.Description != nil && len(*row.Description) > 5000 {
		errs = append(errs, "Description is too long (maximum is 5000 characters)")
	}
	if row.StartAt.IsZero() {
		errs = append(errs, "Start at can't be blank")
	}
	if row.EndAt.IsZero() {
		errs = append(errs, "End at can't be blank")
	}
	if !row.StartAt.IsZero() && !row.EndAt.IsZero() && !row.EndAt.After(row.StartAt) {
		errs = append(errs, "End at must be after start_at")
	}
	if row.RecurrenceRule != nil && strings.TrimSpace(*row.RecurrenceRule) != "" {
		rule, err := decodeRule(row.RecurrenceRule)
		if err != nil {
			return err
		}
		if err := validateRecurrence(rule); err != nil {
			return err
		}
	}
	if len(errs) > 0 {
		return unprocessable(strings.Join(errs, ", "))
	}
	return nil
}

func validateRecurrence(rule *recurrence.Rule) error {
	var errs []string
	if rule == nil {
		return nil
	}
	if _, ok := recurrence.AllowedFrequencies[rule.Frequency]; !ok {
		errs = append(errs, "Recurrence rule frequency must be one of daily, weekly, monthly")
	}
	if rule.Interval < 1 {
		errs = append(errs, "Recurrence rule interval must be a positive integer")
	}
	if rule.Until != "" {
		if _, err := time.Parse("2006-01-02", rule.Until); err != nil {
			errs = append(errs, "Recurrence rule until must be a valid date")
		}
	}
	if len(errs) > 0 {
		return unprocessable(strings.Join(errs, ", "))
	}
	return nil
}

func decodeRule(raw *string) (*recurrence.Rule, error) {
	if raw == nil {
		return nil, nil
	}
	rule, err := recurrence.Deserialize(*raw)
	if err != nil {
		return nil, unprocessable("recurrence_rule is not valid JSON")
	}
	return rule, nil
}

func toResponse(row db.Event, rule *recurrence.Rule, start, end time.Time) EventResponse {
	var params *RecurrenceParams
	if rule != nil {
		p := RecurrenceParams{Frequency: rule.Frequency, Interval: rule.Interval}
		if rule.Until != "" {
			u := rule.Until
			p.Until = &u
		}
		params = &p
	}
	return EventResponse{
		ID:          row.ID,
		Title:       row.Title,
		Description: row.Description,
		StartAt:     start.UTC(),
		EndAt:       end.UTC(),
		AllDay:      row.AllDay,
		Recurring:   rule != nil,
		Recurrence:  params,
	}
}

func parseDate(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Time{}, badRequest("invalid date: " + value)
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", value); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.ParseInLocation("2006-01-02 15:04", value, time.UTC); err == nil {
		return t, nil
	}
	return time.Time{}, badRequest("invalid date: " + value)
}
