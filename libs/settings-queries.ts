/**
 * SQL queries for the settings table, ported from engine/leadsdb_engine/db.py.
 *
 * These use `$1`, `$2`, ... parameterized placeholders (pg driver convention).
 */

export const GET_SETTING = `
SELECT int_value, text_value, float_value, bool_value,
       is_secret, encrypted_value, label, description, category
FROM settings
WHERE key = $1
`;

export const GET_ALL_SETTINGS = `
SELECT key, int_value, text_value, float_value, bool_value,
       is_secret, encrypted_value, label, description, category
FROM settings
ORDER BY category, key
`;

export const GET_SETTINGS_BY_CATEGORY = `
SELECT key, int_value, text_value, float_value, bool_value,
       is_secret, encrypted_value, label, description, category
FROM settings
WHERE category = $1
`;

export const UPSERT_SETTING = `
INSERT INTO settings
    (key, int_value, text_value, float_value, bool_value, is_secret,
     encrypted_value, label, description, category)
VALUES
    ($1, $2, $3, $4, $5, false,
     NULL, $6, $7, $8)
ON CONFLICT (key) DO UPDATE SET
    int_value       = COALESCE(EXCLUDED.int_value,   settings.int_value),
    text_value      = COALESCE(EXCLUDED.text_value,  settings.text_value),
    float_value     = COALESCE(EXCLUDED.float_value, settings.float_value),
    bool_value      = COALESCE(EXCLUDED.bool_value,  settings.bool_value),
    is_secret       = false,
    encrypted_value = NULL,
    label           = COALESCE(EXCLUDED.label,        settings.label),
    description     = COALESCE(EXCLUDED.description,  settings.description),
    category        = COALESCE(EXCLUDED.category,     settings.category),
    updated_at      = NOW()
`;

export const UPSERT_SECRET = `
INSERT INTO settings
    (key, int_value, text_value, float_value, bool_value, is_secret,
     encrypted_value, label, description, category)
VALUES
    ($1, NULL, NULL, NULL, NULL, true, $2,
     $3, $4, $5)
ON CONFLICT (key) DO UPDATE SET
    is_secret       = true,
    encrypted_value = EXCLUDED.encrypted_value,
    label           = COALESCE(EXCLUDED.label,        settings.label),
    description     = COALESCE(EXCLUDED.description,  settings.description),
    category        = COALESCE(EXCLUDED.category,     settings.category),
    updated_at      = NOW()
`;
