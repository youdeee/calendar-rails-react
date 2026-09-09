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

const reminderMinutesMax int32 = 43_200

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
	ID              int64
	Title           string
	Description     *string
	StartAt         *time.Time
	EndAt           *time.Time
	StartOn         *string
	EndOn           *string
	AllDay          bool
	ReminderMinutes *int32
	Recurring       bool
	Recurrence      *RecurrenceParams
}

type CreateInput struct {
	Title           *string
	Description     *string
	StartAt         *time.Time
	EndAt           *time.Time
	StartOn         *time.Time
	EndOn           *time.Time
	AllDay          *bool
	ReminderMinutes *int32
	Recurrence      *RecurrenceParams
}

type UpdateInput struct {
	Title                    *string
	Description              *string
	StartAt                  *time.Time
	EndAt                    *time.Time
	StartOn                  *time.Time
	EndOn                    *time.Time
	AllDay                   *bool
	ReminderMinutes          *int32
	ReminderMinutesSpecified bool
	Recurrence               *RecurrenceParams
	RecurrenceSpecified      bool
}

type Service struct {
	q      *db.Queries
	mailer Mailer
}

func NewService(q *db.Queries, mailer Mailer) *Service {
	if mailer == nil {
		mailer = NopMailer{}
	}
	return &Service{q: q, mailer: mailer}
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
	loc := locationOf(user.TimeZone)
	zoneStart := civilIn(from, loc)
	zoneEnd := civilIn(toBoundary, loc)
	rows, err := s.q.FindEventCandidates(ctx, db.FindEventCandidatesParams{
		UserID:        user.ID,
		RangeFrom:     &from,
		ToBoundary:    &toBoundary,
		ZoneStartDate: &zoneStart,
		ZoneEndDate:   &zoneEnd,
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
		if row.AllDay {
			if row.StartOn == nil || row.EndOn == nil {
				continue
			}
			durationDays := int(row.EndOn.UTC().Sub(row.StartOn.UTC()).Hours() / 24)
			for _, startOn := range recurrence.AllDayOccurrencesBetween(*row.StartOn, *row.EndOn, from, to, loc, rule) {
				endOn := startOn.AddDate(0, 0, durationDays)
				out = append(out, toAllDayResponse(row, rule, startOn, endOn))
			}
			continue
		}
		if row.StartAt == nil || row.EndAt == nil {
			continue
		}
		duration := row.EndAt.Sub(*row.StartAt)
		for _, start := range recurrence.OccurrencesBetween(*row.StartAt, *row.EndAt, from, to, rule) {
			out = append(out, toTimedResponse(row, rule, start, start.Add(duration)))
		}
	}
	return out, nil
}

func (s *Service) Create(ctx context.Context, user auth.User, in CreateInput) (EventResponse, error) {
	row := db.Event{
		UserID:          user.ID,
		AllDay:          in.AllDay != nil && *in.AllDay,
		ReminderMinutes: in.ReminderMinutes,
	}
	if in.Title != nil {
		row.Title = *in.Title
	}
	row.Description = in.Description
	row.StartAt = utcPtr(in.StartAt)
	row.EndAt = utcPtr(in.EndAt)
	row.StartOn = civilPtr(in.StartOn)
	row.EndOn = civilPtr(in.EndOn)
	if err := applyRecurrence(&row, true, in.Recurrence); err != nil {
		return EventResponse{}, err
	}
	applyScheduleKind(&row)
	if err := validate(row); err != nil {
		return EventResponse{}, err
	}
	now := time.Now().UTC()
	saved, err := s.q.InsertEvent(ctx, db.InsertEventParams{
		UserID:          row.UserID,
		Title:           row.Title,
		Description:     row.Description,
		StartAt:         row.StartAt,
		EndAt:           row.EndAt,
		StartOn:         row.StartOn,
		EndOn:           row.EndOn,
		AllDay:          row.AllDay,
		ReminderMinutes: row.ReminderMinutes,
		RecurrenceRule:  row.RecurrenceRule,
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		return EventResponse{}, err
	}
	_ = s.Dispatch(ctx, &saved.ID, time.Now().UTC())
	return toResponse(saved)
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
		row.StartAt = utcPtr(in.StartAt)
	}
	if in.EndAt != nil {
		row.EndAt = utcPtr(in.EndAt)
	}
	if in.StartOn != nil {
		row.StartOn = civilPtr(in.StartOn)
	}
	if in.EndOn != nil {
		row.EndOn = civilPtr(in.EndOn)
	}
	if in.AllDay != nil {
		row.AllDay = *in.AllDay
	}
	if in.ReminderMinutesSpecified {
		row.ReminderMinutes = in.ReminderMinutes
	}
	if in.RecurrenceSpecified {
		if err := applyRecurrence(&row, true, in.Recurrence); err != nil {
			return EventResponse{}, err
		}
	}
	applyScheduleKind(&row)
	if err := validate(row); err != nil {
		return EventResponse{}, err
	}
	saved, err := s.q.UpdateEvent(ctx, db.UpdateEventParams{
		ID:              row.ID,
		UserID:          row.UserID,
		Title:           row.Title,
		Description:     row.Description,
		StartAt:         row.StartAt,
		EndAt:           row.EndAt,
		StartOn:         row.StartOn,
		EndOn:           row.EndOn,
		AllDay:          row.AllDay,
		ReminderMinutes: row.ReminderMinutes,
		RecurrenceRule:  row.RecurrenceRule,
		UpdatedAt:       time.Now().UTC(),
	})
	if err != nil {
		return EventResponse{}, err
	}
	_ = s.Dispatch(ctx, &saved.ID, time.Now().UTC())
	return toResponse(saved)
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

func applyScheduleKind(row *db.Event) {
	if row.AllDay {
		row.StartAt = nil
		row.EndAt = nil
	} else {
		row.StartOn = nil
		row.EndOn = nil
	}
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
	if row.AllDay {
		if row.StartOn == nil {
			errs = append(errs, "Start on can't be blank")
		}
		if row.EndOn == nil {
			errs = append(errs, "End on can't be blank")
		}
		if row.StartOn != nil && row.EndOn != nil && row.EndOn.Before(*row.StartOn) {
			errs = append(errs, "End on must be on or after start_on")
		}
	} else {
		if row.StartAt == nil {
			errs = append(errs, "Start at can't be blank")
		}
		if row.EndAt == nil {
			errs = append(errs, "End at can't be blank")
		}
		if row.StartAt != nil && row.EndAt != nil && !row.EndAt.After(*row.StartAt) {
			errs = append(errs, "End at must be after start_at")
		}
	}
	if row.ReminderMinutes != nil && (*row.ReminderMinutes < 1 || *row.ReminderMinutes > reminderMinutesMax) {
		errs = append(errs, "Reminder minutes is not a number")
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

func toResponse(row db.Event) (EventResponse, error) {
	rule, err := decodeRule(row.RecurrenceRule)
	if err != nil {
		return EventResponse{}, err
	}
	if row.AllDay {
		start, end := time.Time{}, time.Time{}
		if row.StartOn != nil {
			start = *row.StartOn
		}
		if row.EndOn != nil {
			end = *row.EndOn
		}
		return toAllDayResponse(row, rule, start, end), nil
	}
	start, end := time.Time{}, time.Time{}
	if row.StartAt != nil {
		start = *row.StartAt
	}
	if row.EndAt != nil {
		end = *row.EndAt
	}
	return toTimedResponse(row, rule, start, end), nil
}

func toTimedResponse(row db.Event, rule *recurrence.Rule, start, end time.Time) EventResponse {
	s := start.UTC()
	e := end.UTC()
	return EventResponse{
		ID:              row.ID,
		Title:           row.Title,
		Description:     row.Description,
		StartAt:         &s,
		EndAt:           &e,
		AllDay:          row.AllDay,
		ReminderMinutes: row.ReminderMinutes,
		Recurring:       rule != nil,
		Recurrence:      recurrenceParams(rule),
	}
}

func toAllDayResponse(row db.Event, rule *recurrence.Rule, startOn, endOn time.Time) EventResponse {
	return EventResponse{
		ID:              row.ID,
		Title:           row.Title,
		Description:     row.Description,
		StartOn:         dateJSON(startOn),
		EndOn:           dateJSON(endOn),
		AllDay:          row.AllDay,
		ReminderMinutes: row.ReminderMinutes,
		Recurring:       rule != nil,
		Recurrence:      recurrenceParams(rule),
	}
}

func recurrenceParams(rule *recurrence.Rule) *RecurrenceParams {
	if rule == nil {
		return nil
	}
	p := RecurrenceParams{Frequency: rule.Frequency, Interval: rule.Interval}
	if rule.Until != "" {
		u := rule.Until
		p.Until = &u
	}
	return &p
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

func locationOf(tz string) *time.Location {
	if strings.TrimSpace(tz) == "" {
		tz = "Asia/Tokyo"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.UTC
	}
	return loc
}

func civilIn(t time.Time, loc *time.Location) time.Time {
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func utcPtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	v := t.UTC()
	return &v
}

func civilPtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	y, m, d := t.UTC().Date()
	v := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	return &v
}

func dateJSON(t time.Time) *string {
	s := t.UTC().Format("2006-01-02")
	return &s
}
