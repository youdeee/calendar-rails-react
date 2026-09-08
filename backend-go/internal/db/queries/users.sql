-- name: FindUserByID :one
SELECT id, email, google_uid, name, avatar_url, created_at, updated_at
FROM users
WHERE id = $1;

-- name: FindUserByEmail :one
SELECT id, email, google_uid, name, avatar_url, created_at, updated_at
FROM users
WHERE email = $1;

-- name: InsertUser :one
INSERT INTO users (email, google_uid, name, avatar_url, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, email, google_uid, name, avatar_url, created_at, updated_at;

-- name: UpdateUser :one
UPDATE users
SET email = $2,
    google_uid = $3,
    name = $4,
    avatar_url = $5,
    updated_at = $6
WHERE id = $1
RETURNING id, email, google_uid, name, avatar_url, created_at, updated_at;
