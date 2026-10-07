-- Table: config
-- Stores per-guild key/value configuration.
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (guild_id, key)
);

-- Table: customCommand
-- Stores custom prefix commands per guild.
CREATE TABLE IF NOT EXISTS customCommand (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  command TEXT NOT NULL,
  description TEXT NOT NULL,
  response TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (guild_id, command)
);

-- Recommendations published by guild members.
CREATE TABLE IF NOT EXISTS recommendation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  creator TEXT,
  duration_seconds INTEGER,
  release_date TEXT,
  image_url TEXT,
  source_url TEXT NOT NULL,
  price TEXT,
  rating TEXT,
  recommended_by_id TEXT NOT NULL,
  recommended_by_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (guild_id, type, external_id)
);

-- Upvotes can come from the command or either supported Discord reaction.
-- A member is counted once even when several sources are active.
CREATE TABLE IF NOT EXISTS recommendation_upvote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recommendation_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recommendation_id) REFERENCES recommendation(id) ON DELETE CASCADE,
  UNIQUE (recommendation_id, user_id, source)
);

CREATE TABLE IF NOT EXISTS noot_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', url TEXT,
  status TEXT NOT NULL DEFAULT 'wishlist', created_by TEXT NOT NULL,
  source_key TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guild_id, source_key)
);
CREATE TABLE IF NOT EXISTS noot_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES noot_item(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, date TEXT NOT NULL, rating REAL,
  comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(rating IS NULL OR (rating >= 0 AND rating <= 5)),
  UNIQUE(item_id, user_id, date)
);
CREATE TABLE IF NOT EXISTS noot_conversation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL, content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS noot_item_guild ON noot_item(guild_id);
CREATE INDEX IF NOT EXISTS noot_conversation_scope ON noot_conversation(guild_id, channel_id, user_id);

CREATE TABLE IF NOT EXISTS noot_publication (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES noot_item(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL, message_id TEXT NOT NULL,
  UNIQUE(channel_id, message_id)
);
