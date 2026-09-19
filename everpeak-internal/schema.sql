-- EverPeak Internal System — D1 Schema
-- Run with: wrangler d1 execute everpeak-internal-db --file=./schema.sql --remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('manager','rep')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('manager','rep')),
  invited_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_attempts (
  key             TEXT PRIMARY KEY, -- email or ip
  count           INTEGER NOT NULL DEFAULT 0,
  first_attempt   TEXT NOT NULL,
  locked_until    TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id           TEXT PRIMARY KEY,
  client_id    TEXT REFERENCES clients(id) ON DELETE SET NULL,
  date         TEXT NOT NULL,   -- YYYY-MM-DD
  start_time   TEXT NOT NULL,   -- HH:MM 24h
  end_time     TEXT NOT NULL,
  session_type TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'confirmed', -- confirmed/pending/cancelled
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  client_id  TEXT REFERENCES clients(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  amount     REAL NOT NULL,
  method     TEXT,
  status     TEXT NOT NULL DEFAULT 'paid', -- paid/pending/refunded
  paid_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- booking | client | payment | general
  entity_id   TEXT,
  author_id   TEXT REFERENCES users(id),
  content     TEXT NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);

-- Weekly recurring availability template (manager-editable)
CREATE TABLE IF NOT EXISTS availability_rules (
  id         TEXT PRIMARY KEY,
  day_of_week INTEGER NOT NULL, -- 0=Sunday ... 6=Saturday
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

-- One-off overrides: block out a date entirely, or open an extra date
CREATE TABLE IF NOT EXISTS availability_overrides (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL, -- YYYY-MM-DD
  type       TEXT NOT NULL CHECK (type IN ('closed','open')),
  start_time TEXT,
  end_time   TEXT,
  note       TEXT
);
