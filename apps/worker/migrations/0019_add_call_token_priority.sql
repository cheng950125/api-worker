ALTER TABLE channel_call_tokens
ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS channel_call_tokens_channel_id;
DROP INDEX IF EXISTS idx_channel_call_tokens_channel_id;

CREATE INDEX IF NOT EXISTS idx_channel_call_tokens_channel_id
ON channel_call_tokens (channel_id, priority, created_at, id);
