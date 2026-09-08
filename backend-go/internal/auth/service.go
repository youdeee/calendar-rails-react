package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/db"
)

var (
	ErrUnauthorized       = errors.New("Unauthorized")
	ErrInvalidGoogleToken = errors.New("Invalid Google token")
)

type Profile struct {
	GoogleUID     string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
}

type GoogleVerifier interface {
	Verify(ctx context.Context, idToken string) (Profile, error)
}

type User struct {
	ID        int64
	Email     string
	GoogleUID string
	Name      string
	AvatarURL *string
}

type Session struct {
	AccessToken     string
	RawRefreshToken string
	User            User
}

type Service struct {
	q         *db.Queries
	google    GoogleVerifier
	secret    []byte
	accessTTL time.Duration
}

func NewService(q *db.Queries, google GoogleVerifier, jwtSecret string, accessTTL time.Duration) *Service {
	return &Service{q: q, google: google, secret: []byte(jwtSecret), accessTTL: accessTTL}
}

func (s *Service) Login(ctx context.Context, idToken string) (Session, error) {
	profile, err := s.google.Verify(ctx, idToken)
	if err != nil {
		return Session{}, ErrInvalidGoogleToken
	}
	if !profile.EmailVerified {
		return Session{}, ErrInvalidGoogleToken
	}
	user, err := s.upsertUser(ctx, profile)
	if err != nil {
		return Session{}, err
	}
	return s.issueSession(ctx, user)
}

func (s *Service) Refresh(ctx context.Context, raw string) (Session, error) {
	token, err := s.authenticateRefresh(ctx, raw)
	if err != nil {
		return Session{}, err
	}
	n, err := s.q.ClaimIfActive(ctx, token.ID)
	if err != nil {
		return Session{}, err
	}
	if n == 0 {
		return Session{}, ErrUnauthorized
	}
	row, err := s.q.FindUserByID(ctx, token.UserID)
	if err != nil {
		return Session{}, ErrUnauthorized
	}
	return s.issueSession(ctx, userFromRow(row))
}

func (s *Service) Logout(ctx context.Context, raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	token, err := s.q.FindRefreshTokenByDigest(ctx, digest(raw))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	return s.q.RevokeRefreshToken(ctx, token.ID)
}

func (s *Service) UserByID(ctx context.Context, id int64) (User, error) {
	row, err := s.q.FindUserByID(ctx, id)
	if err != nil {
		return User{}, err
	}
	return userFromRow(row), nil
}

func (s *Service) Encode(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"sub": strconv.FormatInt(userID, 10),
		"exp": time.Now().Add(s.accessTTL).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *Service) ParseUserID(token string) (int64, error) {
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, ErrUnauthorized
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !parsed.Valid {
		return 0, ErrUnauthorized
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return 0, ErrUnauthorized
	}
	sub, _ := claims["sub"].(string)
	id, err := strconv.ParseInt(sub, 10, 64)
	if err != nil {
		return 0, ErrUnauthorized
	}
	return id, nil
}

func (s *Service) authenticateRefresh(ctx context.Context, raw string) (db.RefreshToken, error) {
	if strings.TrimSpace(raw) == "" {
		return db.RefreshToken{}, ErrUnauthorized
	}
	token, err := s.q.FindRefreshTokenByDigest(ctx, digest(raw))
	if err != nil {
		return db.RefreshToken{}, ErrUnauthorized
	}
	if token.RevokedAt != nil {
		_ = s.q.RevokeAllActiveByUserID(ctx, token.UserID)
		return db.RefreshToken{}, ErrUnauthorized
	}
	if time.Now().After(token.ExpiresAt) {
		return db.RefreshToken{}, ErrUnauthorized
	}
	return token, nil
}

func (s *Service) upsertUser(ctx context.Context, profile Profile) (User, error) {
	now := time.Now().UTC()
	name := profile.Name
	if strings.TrimSpace(name) == "" {
		name = profile.Email
	}
	var avatar *string
	if profile.Picture != "" {
		avatar = &profile.Picture
	}
	existing, err := s.q.FindUserByEmail(ctx, profile.Email)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return User{}, err
		}
		row, err := s.q.InsertUser(ctx, db.InsertUserParams{
			Email:     profile.Email,
			GoogleUid: profile.GoogleUID,
			Name:      name,
			AvatarUrl: avatar,
			CreatedAt: now,
			UpdatedAt: now,
		})
		if err != nil {
			return User{}, err
		}
		return userFromRow(row), nil
	}
	row, err := s.q.UpdateUser(ctx, db.UpdateUserParams{
		ID:        existing.ID,
		Email:     profile.Email,
		GoogleUid: profile.GoogleUID,
		Name:      name,
		AvatarUrl: avatar,
		UpdatedAt: now,
	})
	if err != nil {
		return User{}, err
	}
	return userFromRow(row), nil
}

func (s *Service) issueSession(ctx context.Context, user User) (Session, error) {
	raw, err := randomHex(32)
	if err != nil {
		return Session{}, err
	}
	now := time.Now().UTC()
	_, err = s.q.InsertRefreshToken(ctx, db.InsertRefreshTokenParams{
		UserID:      user.ID,
		TokenDigest: digest(raw),
		ExpiresAt:   now.Add(30 * 24 * time.Hour),
		RevokedAt:   nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		return Session{}, err
	}
	access, err := s.Encode(user.ID)
	if err != nil {
		return Session{}, err
	}
	return Session{AccessToken: access, RawRefreshToken: raw, User: user}, nil
}

func userFromRow(row db.User) User {
	return User{
		ID:        row.ID,
		Email:     row.Email,
		GoogleUID: row.GoogleUid,
		Name:      row.Name,
		AvatarURL: row.AvatarUrl,
	}
}

func digest(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
