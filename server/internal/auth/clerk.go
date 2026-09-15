package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Verifier verifies Clerk-issued session JWTs via Clerk's published JWKS,
// replacing @clerk/backend's verifyToken() from lib/server/trpc.ts.
type Verifier struct {
	jwks   keyfunc.Keyfunc
	issuer string
}

func NewVerifier(ctx context.Context, jwksURL, issuer string) (*Verifier, error) {
	jwks, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("fetching Clerk JWKS: %w", err)
	}
	return &Verifier{jwks: jwks, issuer: issuer}, nil
}

// VerifyToken validates signature, exp/nbf, and issuer, returning the
// Clerk user id (the token's `sub` claim) on success.
func (v *Verifier) VerifyToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, v.jwks.Keyfunc,
		jwt.WithIssuer(v.issuer),
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithLeeway(5*time.Second),
	)
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}
	if !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	sub, err := token.Claims.GetSubject()
	if err != nil || sub == "" {
		return "", fmt.Errorf("token missing sub claim")
	}
	return sub, nil
}
