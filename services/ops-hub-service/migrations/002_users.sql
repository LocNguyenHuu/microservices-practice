-- Users table for dashboard authentication and RBAC.
-- Passwords are bcrypt-hashed. Roles control UI access permissions.

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    role        VARCHAR(30) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','ops_manager','crew_supervisor','ground_crew','viewer')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default admin user (password: admin)
-- bcrypt hash generated with cost factor 12
INSERT INTO users (username, password_hash, email, role)
VALUES ('admin', '$2b$12$LJ3m4ys3Lk0TSwHlmPmvhOmKlQv8F6kX8J7cGqQrN0TtDvUwKjGe6', 'admin@skyturn.aero', 'admin');
