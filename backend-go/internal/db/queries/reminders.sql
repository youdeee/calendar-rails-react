-- name: FindReminderDelivery :one
SELECT id, user_id, event_id, occurrence_start_at, delivered_at, created_at, updated_at
FROM reminder_deliveries
WHERE event_id = $1 AND occurrence_start_at = $2;

-- name: InsertReminderDelivery :execrows
INSERT INTO reminder_deliveries (user_id, event_id, occurrence_start_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (event_id, occurrence_start_at) DO NOTHING;

-- name: MarkReminderDelivered :exec
UPDATE reminder_deliveries
SET delivered_at = $2,
    updated_at = $2
WHERE id = $1 AND delivered_at IS NULL;
