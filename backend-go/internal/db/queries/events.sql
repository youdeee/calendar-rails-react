-- name: FindEventByIDAndUserID :one
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at
FROM events
WHERE id = $1 AND user_id = $2;

-- name: FindEventCandidates :many
SELECT id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at
FROM events
WHERE user_id = sqlc.arg(user_id)
  AND (
    (recurrence_rule IS NULL AND start_at <= sqlc.arg(to_boundary) AND end_at >= sqlc.arg(range_from))
    OR (recurrence_rule IS NOT NULL AND start_at <= sqlc.arg(to_boundary))
  );

-- name: InsertEvent :one
INSERT INTO events (user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at;

-- name: UpdateEvent :one
UPDATE events
SET title = $3,
    description = $4,
    start_at = $5,
    end_at = $6,
    all_day = $7,
    recurrence_rule = $8,
    updated_at = $9
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, title, description, start_at, end_at, all_day, recurrence_rule, created_at, updated_at;

-- name: DeleteEvent :execrows
DELETE FROM events WHERE id = $1 AND user_id = $2;
