import { createClient } from "@supabase/supabase-js";
import ws from "ws";

if (typeof global !== "undefined" && !global.WebSocket) {
  (global as any).WebSocket = ws;
}

// Use dummy URL/Key if not provided, to prevent crash during development
const SUPABASE_URL = process.env.SUPABASE_URL || "https://placeholder-url.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export type MatchData = {
  roomId: string;
  startedAt: string;
  endedAt: string;
  winnerId: string;
  playerCount: number;
};

export type MatchPlayer = {
  userId: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  foodsCollected: number;
  rank: number;
};

export type MatchQuestionLog = {
  userId: string;
  questionId: string;
  answeredChoice: string;
  isCorrect: boolean;
  answeredAt: string;
};

export class SupabaseService {
  /**
   * Save match data in a batch/sequential transaction.
   * If an RPC is available in the future, it should be used here for true transactional integrity.
   */
  static async saveMatch(
    match: MatchData,
    players: MatchPlayer[],
    questionLogs: MatchQuestionLog[]
  ): Promise<boolean> {
    if (!process.env.SUPABASE_URL) {
      console.warn("[SupabaseService] SUPABASE_URL not set. Skipping DB save (Mock success).");
      return true; // Mock success for local dev without DB
    }

    try {
      // 1. Insert Match
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .insert({
          room_id: match.roomId,
          started_at: match.startedAt,
          ended_at: match.endedAt,
          winner_id: match.winnerId, // can be null if tie or no points
          player_count: match.playerCount
        })
        .select("id")
        .single();

      if (matchError) throw matchError;
      const matchId = matchData.id;

      // 2. Insert Players
      if (players.length > 0) {
        const { error: playersError } = await supabase
          .from("match_players")
          .insert(
            players.map(p => ({
              match_id: matchId,
              user_id: p.userId, // Assuming user_id is text/UUID that matches client session/auth
              score: p.score,
              correct_answers: p.correctAnswers,
              wrong_answers: p.wrongAnswers,
              foods_collected: p.foodsCollected,
              rank: p.rank
            }))
          );
        if (playersError) throw playersError;
      }

      // 3. Insert Question Logs
      if (questionLogs.length > 0) {
        const { error: logsError } = await supabase
          .from("match_question_log")
          .insert(
            questionLogs.map(l => ({
              match_id: matchId,
              user_id: l.userId,
              question_id: l.questionId,
              answered_choice: l.answeredChoice,
              is_correct: l.isCorrect,
              answered_at: l.answeredAt
            }))
          );
        if (logsError) throw logsError;
      }

      console.log(`[SupabaseService] Successfully saved match ${matchId} to DB.`);
      return true;
    } catch (err) {
      console.error("[SupabaseService] Failed to save match to DB:", err);
      return false; // Indicates failure so MatchLogger doesn't delete the backup
    }
  }
}
