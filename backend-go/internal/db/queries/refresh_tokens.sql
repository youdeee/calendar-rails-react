-- name: FindRefreshTokenByDigest :one
SELECT id, user_id, token_digest, expires_at, revoked_at, created_at, updated_at
FROM refresh_tokens
WHERE token_digest = $1;

-- name: InsertRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_digest, expires_at, revoked_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, token_digest, expires_at, revoked_at, created_at, updated_at;

-- name: ClaimIfActive :execrows
UPDATE refresh_tokens
SET revoked_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND revoked_at IS NULL;

-- name: RevokeAllActiveByUserID :exec
UPDATE refresh_tokens
SET revoked_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1;
