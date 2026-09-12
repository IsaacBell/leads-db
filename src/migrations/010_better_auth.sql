-- Better Auth (self-hosted auth) schema.
--
-- Tables are created by Better Auth's adapter against the field keys below.
-- Columns are camelCase by default (Better Auth default naming); do NOT
-- snake_case them or the adapter cannot find its fields.
--
-- Magic-link sign-in needs `user`, `session`, and `verification`. `account`
-- is reserved for OAuth / password providers; created now so social or
-- email/password can be enabled later without another migration.
--
-- Applied via: just leadsdb-migrate  (psql over LDB_DATABASE_URL)

-- --------------------------------------------------------------------------
-- user
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
    id            TEXT PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    emailVerified BOOLEAN     NOT NULL DEFAULT false,
    image         TEXT,
    createdAt     TIMESTAMPTZ NOT NULL,
    updatedAt     TIMESTAMPTZ NOT NULL
);

-- --------------------------------------------------------------------------
-- session
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session" (
    id        TEXT PRIMARY KEY,
    token     TEXT        NOT NULL UNIQUE,
    userId    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    expiresAt TIMESTAMPTZ NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TIMESTAMPTZ NOT NULL,
    updatedAt TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_userId    ON "session" (userId);
CREATE INDEX IF NOT EXISTS idx_session_expiresAt ON "session" (expiresAt);

-- --------------------------------------------------------------------------
-- account  (OAuth / password provider linkage)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "account" (
    id                    TEXT PRIMARY KEY,
    userId                TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    providerId            TEXT NOT NULL,
    accountId             TEXT NOT NULL,
    accessToken           TEXT,
    refreshToken          TEXT,
    idToken               TEXT,
    accessTokenExpiresAt  TIMESTAMPTZ,
    refreshTokenExpiresAt TIMESTAMPTZ,
    scope                 TEXT,
    password              TEXT,
    createdAt             TIMESTAMPTZ NOT NULL,
    updatedAt             TIMESTAMPTZ NOT NULL,
    CONSTRAINT account_provider_unique UNIQUE (providerId, accountId)
);

CREATE INDEX IF NOT EXISTS idx_account_userId ON "account" (userId);

-- --------------------------------------------------------------------------
-- verification  (magic-link tokens, password reset, email verify)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "verification" (
    id         TEXT PRIMARY KEY,
    identifier TEXT        NOT NULL,
    value      TEXT        NOT NULL,
    expiresAt  TIMESTAMPTZ NOT NULL,
    createdAt  TIMESTAMPTZ NOT NULL,
    updatedAt  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification" (identifier);

COMMENT ON TABLE "user"         IS 'Better Auth user identities.';
COMMENT ON TABLE "session"      IS 'Better Auth browser sessions.';
COMMENT ON TABLE "account"      IS 'Better Auth OAuth/password provider accounts.';
COMMENT ON TABLE "verification" IS 'Better Auth one-time tokens (magic link, resets).';
