# ADR-003: Clerk for Authentication

**Status:** Accepted

**Date:** 2026-02-12

## Context

RadBooks needs authentication that supports:
- Email/password registration and login
- Social login providers (Google, etc.)
- Secure session management
- User profile management
- Multi-organization access (a user can belong to multiple orgs)

We evaluated building custom auth, using NextAuth.js, and using Clerk.

## Decision

We chose **Clerk** as our authentication provider.

Key integration points:
- `@clerk/nextjs` middleware protects all routes by default
- Public routes are explicitly whitelisted in middleware configuration
- Clerk `userId` (external auth ID) is mapped to our internal `User` model via `authId` field
- On first visit after login, the profile page creates the internal User if it doesn't exist
- Email migration: if `authId` doesn't match, we fall back to email lookup to handle Clerk instance migrations

We wrap Clerk's `ClerkProvider` in a `SafeClerkProvider` client component to prevent `useContext` null errors during Next.js static prerendering.

## Consequences

### Positive
- Production-grade auth out of the box (password hashing, session management, MFA)
- Social login support without custom OAuth implementation
- Pre-built UI components for login/register flows
- Handles security concerns (CSRF, session fixation, etc.)
- Free tier sufficient for current scale

### Negative
- External dependency — auth is critical path
- Clerk `userId` is opaque — we maintain a separate User model for app-specific data
- Instance migrations require email-based fallback logic
- Static prerendering requires SafeClerkProvider workaround
- Testing requires mock Clerk keys in CI
