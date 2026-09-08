package auth

import (
	"context"
	"strings"

	"google.golang.org/api/idtoken"

	"github.com/youdeee/calendar-rails-react/backend-go/internal/config"
)

type googleVerifier struct {
	clientID string
}

func NewGoogleVerifier(cfg config.Config) GoogleVerifier {
	return googleVerifier{clientID: cfg.GoogleClientID}
}

func (g googleVerifier) Verify(ctx context.Context, idToken string) (Profile, error) {
	payload, err := idtoken.Validate(ctx, idToken, g.clientID)
	if err != nil {
		return Profile{}, ErrInvalidGoogleToken
	}
	email, _ := payload.Claims["email"].(string)
	verified, _ := payload.Claims["email_verified"].(bool)
	if v, ok := payload.Claims["email_verified"].(string); ok {
		verified = strings.EqualFold(v, "true")
	}
	name, _ := payload.Claims["name"].(string)
	picture, _ := payload.Claims["picture"].(string)
	return Profile{
		GoogleUID:     payload.Subject,
		Email:         email,
		EmailVerified: verified,
		Name:          name,
		Picture:       picture,
	}, nil
}
