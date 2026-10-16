CREATE TABLE IF NOT EXISTS repos (
  repo_id         TEXT PRIMARY KEY,
  name            TEXT,
  owner_key_hash  TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  member_id  TEXT PRIMARY KEY,
  repo_id    TEXT NOT NULL,
  label      TEXT,
  key_hash   TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'member',
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_repo ON members(repo_id);

CREATE TABLE IF NOT EXISTS versions (
  repo_id          TEXT NOT NULL,
  version          INTEGER NOT NULL,
  created_at       INTEGER NOT NULL,
  author_member_id TEXT,
  size_bytes       INTEGER NOT NULL,
  chunk_count      INTEGER NOT NULL,
  PRIMARY KEY (repo_id, version)
);

CREATE TABLE IF NOT EXISTS version_blobs (
  repo_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  seq     INTEGER NOT NULL,
  data    BLOB NOT NULL,
  PRIMARY KEY (repo_id, version, seq)
);

CREATE TABLE IF NOT EXISTS attachment_chunks (
  repo_id            TEXT NOT NULL,
  hash               TEXT NOT NULL,
  url                TEXT NOT NULL,
  drive_file_id      TEXT,
  uploader_member_id TEXT,
  size_bytes         INTEGER,
  created_at         INTEGER NOT NULL,
  PRIMARY KEY (repo_id, hash)
);

CREATE TABLE IF NOT EXISTS attachment_files (
  repo_id       TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  hashes        TEXT NOT NULL,
  last_modified INTEGER NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, file_name)
);

CREATE TABLE IF NOT EXISTS rate_counters (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_window ON rate_counters(window_start);
