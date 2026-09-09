package event

import (
	"fmt"
	"net/smtp"
	"strings"
	"sync"
	"time"
)

type Mailer interface {
	SendReminder(to, subject, body, ics string) error
}

type NopMailer struct{}

func (NopMailer) SendReminder(string, string, string, string) error { return nil }

type RecordingMailer struct {
	mu       sync.Mutex
	Subjects []string
	Bodies   []string
	ICS      []string
}

func (m *RecordingMailer) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Subjects = nil
	m.Bodies = nil
	m.ICS = nil
}

func (m *RecordingMailer) SendReminder(to, subject, body, ics string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Subjects = append(m.Subjects, subject)
	m.Bodies = append(m.Bodies, body)
	m.ICS = append(m.ICS, ics)
	return nil
}

type SMTPMailer struct {
	Addr string
}

func (m SMTPMailer) SendReminder(to, subject, body, ics string) error {
	boundary := "calendar-reminder"
	var b strings.Builder
	fmt.Fprintf(&b, "From: calendar@localhost\r\n")
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", subject)
	fmt.Fprintf(&b, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/mixed; boundary=%s\r\n\r\n", boundary)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", boundary, body)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/calendar; name=event.ics\r\nContent-Disposition: attachment; filename=event.ics\r\n\r\n%s\r\n", boundary, ics)
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return smtp.SendMail(m.Addr, nil, "calendar@localhost", []string{to}, []byte(b.String()))
}

func icsBody(eventTitle string, eventID int64, allDay bool, occurrenceStart *time.Time, occurrenceOn *time.Time, startOn, endOn *time.Time, startAt, endAt *time.Time, now time.Time) string {
	token := ""
	if occurrenceOn != nil {
		token = occurrenceOn.UTC().Format("2006-01-02")
	} else if occurrenceStart != nil {
		token = occurrenceStart.UTC().Format(time.RFC3339)
	}
	stamp := now.UTC().Format("20060102T150405Z")
	dtStart, dtEnd := "", ""
	if allDay && occurrenceOn != nil && startOn != nil && endOn != nil {
		last := occurrenceOn.AddDate(0, 0, int(endOn.UTC().Sub(startOn.UTC()).Hours()/24))
		dtStart = "DTSTART;VALUE=DATE:" + occurrenceOn.UTC().Format("20060102")
		dtEnd = "DTEND;VALUE=DATE:" + last.AddDate(0, 0, 1).UTC().Format("20060102")
	} else if occurrenceStart != nil && startAt != nil && endAt != nil {
		dtStart = "DTSTART:" + occurrenceStart.UTC().Format("20060102T150405Z")
		end := occurrenceStart.Add(endAt.Sub(*startAt))
		dtEnd = "DTEND:" + end.UTC().Format("20060102T150405Z")
	}
	summary := strings.NewReplacer(`\`, `\\`, `;`, `\;`, `,`, `\,`, "\n", `\n`).Replace(eventTitle)
	return strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//calendar//EN",
		"BEGIN:VEVENT",
		"UID:event-" + fmt.Sprint(eventID) + "-" + token + "@calendar.local",
		"DTSTAMP:" + stamp,
		dtStart,
		dtEnd,
		"SUMMARY:" + summary,
		"END:VEVENT",
		"END:VCALENDAR",
	}, "\n") + "\n"
}
