CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'organizer'))
);
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
);
CREATE TABLE registrations (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    UNIQUE(user_id, event_id)
);
ALTER TABLE events ADD COLUMN organizer_id INTEGER REFERENCES users(id);
CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY,
    verifier TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
