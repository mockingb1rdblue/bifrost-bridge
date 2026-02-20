CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  topic TEXT, -- For logical grouping (e.g. issue identifier)
  correlation_id TEXT, -- To link related events
  payload TEXT NOT NULL, -- JSON
  meta TEXT, -- JSON
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic);
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);
