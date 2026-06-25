-- users
CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- questions
CREATE TABLE questions (
  id uuid PRIMARY KEY,
  question text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer char(1),        -- 'a' | 'b' | 'c' | 'd'
  difficulty smallint,           -- 1=dễ, 2=trung, 3=khó
  category text,                 -- 'science' | 'history' | ...
  created_at timestamptz DEFAULT now()
);

-- matches
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  room_id text,
  started_at timestamptz,
  ended_at timestamptz,
  winner_id uuid REFERENCES users(id),
  player_count smallint
);

-- match_players
CREATE TABLE match_players (
  id uuid PRIMARY KEY,
  match_id uuid REFERENCES matches(id),
  user_id uuid REFERENCES users(id),
  score int DEFAULT 0,
  correct_answers int DEFAULT 0,
  wrong_answers int DEFAULT 0,
  foods_collected int DEFAULT 0,
  rank smallint
);

-- match_question_log
CREATE TABLE match_question_log (
  id uuid PRIMARY KEY,
  match_id uuid REFERENCES matches(id),
  user_id uuid REFERENCES users(id),
  question_id uuid REFERENCES questions(id),
  answered_choice char(1),
  is_correct boolean,
  answered_at timestamptz
);
