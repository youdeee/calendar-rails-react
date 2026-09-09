-- name: FindEventByID :one
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes
FROM events
WHERE id = $1;

-- name: FindEventByIDAndUserID :one
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes
FROM events
WHERE id = $1 AND user_id = $2;

-- name: FindEventCandidates :many
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes
FROM events
WHERE user_id = sqlc.arg(user_id)
  AND (
    (all_day = FALSE AND recurrence_rule IS NULL AND start_at <= sqlc.arg(to_boundary) AND end_at >= sqlc.arg(range_from))
    OR (all_day = FALSE AND recurrence_rule IS NOT NULL AND start_at <= sqlc.arg(to_boundary))
    OR (all_day = TRUE AND recurrence_rule IS NULL AND start_on <= sqlc.arg(zone_end_date) AND end_on >= sqlc.arg(zone_start_date))
    OR (all_day = TRUE AND recurrence_rule IS NOT NULL AND start_on <= sqlc.arg(zone_end_date))
  );

-- name: FindEventsWithReminders :many
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes
FROM events
WHERE reminder_minutes IS NOT NULL
  AND (sqlc.narg(id)::bigint IS NULL OR id = sqlc.narg(id));

-- name: InsertEvent :one
INSERT INTO events (user_id, title, description, start_at, end_at, start_on, end_on, all_day, reminder_minutes, recurrence_rule, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes;

-- name: UpdateEvent :one
UPDATE events
SET title = $3,
    description = $4,
    start_at = $5,
    end_at = $6,
    start_on = $7,
    end_on = $8,
    all_day = $9,
    reminder_minutes = $10,
    recurrence_rule = $11,
    updated_at = $12
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at, start_on, end_on, reminder_minutes;

-- name: DeleteEvent :execrows
DELETE FROM events WHERE id = $1 AND user_id = $2;
