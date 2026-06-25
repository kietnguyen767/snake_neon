-- Drop problematic foreign keys (because user_id and question_id are strings from runtime, not DB UUIDs)
ALTER TABLE match_players DROP CONSTRAINT match_players_user_id_fkey;
ALTER TABLE match_question_log DROP CONSTRAINT match_question_log_user_id_fkey;
ALTER TABLE match_question_log DROP CONSTRAINT match_question_log_question_id_fkey;
ALTER TABLE matches DROP CONSTRAINT matches_winner_id_fkey;

-- Change columns to text to accept string IDs (like "guest-123", "q1", Colyseus sessionId)
ALTER TABLE users ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE questions ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE matches ALTER COLUMN winner_id TYPE text USING winner_id::text;
ALTER TABLE match_players ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE match_question_log ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE match_question_log ALTER COLUMN question_id TYPE text USING question_id::text;

-- Set default UUIDs for Primary Keys so SupabaseService doesn't have to provide them
ALTER TABLE matches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE match_players ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE match_question_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
