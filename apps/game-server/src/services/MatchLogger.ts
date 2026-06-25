import fs from "fs";
import path from "path";
import os from "os";
import { MatchQuestionLog, MatchPlayer, MatchData, SupabaseService } from "./SupabaseService";

export class MatchLogger {
  private roomId: string;
  private startedAt: string;
  private logFilePath: string;
  
  // In-memory state for final DB push
  private questionLogs: MatchQuestionLog[] = [];
  private foodsCollected: Map<string, number> = new Map();
  private correctAnswers: Map<string, number> = new Map();
  private wrongAnswers: Map<string, number> = new Map();

  constructor(roomId: string) {
    this.roomId = roomId;
    this.startedAt = new Date().toISOString();
    
    // Create backup file at /tmp/match_<roomId>.log (or os.tmpdir())
    this.logFilePath = path.join(os.tmpdir(), `match_${this.roomId}.log`);
    // Initialize file
    fs.writeFileSync(this.logFilePath, `{"event": "MATCH_START", "roomId": "${this.roomId}", "startedAt": "${this.startedAt}"}\n`, { encoding: 'utf-8' });
  }

  logFoodCollected(userId: string) {
    const current = this.foodsCollected.get(userId) || 0;
    this.foodsCollected.set(userId, current + 1);
    
    // Append to backup file for full durability
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify({ event: "FOOD_COLLECTED", userId }) + '\n', { encoding: 'utf-8' });
    } catch (e) {
      console.error("[MatchLogger] Failed to write to backup file:", e);
    }
  }

  logQuestionAnswer(userId: string, questionId: string, answeredChoice: string, isCorrect: boolean) {
    const answeredAt = new Date().toISOString();
    
    // 1. Update in-memory aggregate
    if (isCorrect) {
      this.correctAnswers.set(userId, (this.correctAnswers.get(userId) || 0) + 1);
    } else {
      this.wrongAnswers.set(userId, (this.wrongAnswers.get(userId) || 0) + 1);
    }

    // 2. Add to in-memory log
    const logEntry: MatchQuestionLog = {
      userId,
      questionId,
      answeredChoice,
      isCorrect,
      answeredAt
    };
    this.questionLogs.push(logEntry);

    // 3. Append to backup file
    const fileEntry = {
      event: "QUESTION_ANSWERED",
      ...logEntry
    };
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(fileEntry) + '\n', { encoding: 'utf-8' });
    } catch (e) {
      console.error("[MatchLogger] Failed to write to backup file:", e);
    }
  }

  async finalizeAndSave(playersData: { id: string, score: number }[]) {
    const endedAt = new Date().toISOString();
    
    // Sort players by score (descending) to determine rank
    const sortedPlayers = [...playersData].sort((a, b) => b.score - a.score);
    
    let winnerId = sortedPlayers.length > 0 && sortedPlayers[0].score > 0 ? sortedPlayers[0].id : "";

    const matchData: MatchData = {
      roomId: this.roomId,
      startedAt: this.startedAt,
      endedAt,
      winnerId,
      playerCount: playersData.length
    };

    const matchPlayers: MatchPlayer[] = sortedPlayers.map((p, index) => ({
      userId: p.id,
      score: p.score,
      correctAnswers: this.correctAnswers.get(p.id) || 0,
      wrongAnswers: this.wrongAnswers.get(p.id) || 0,
      foodsCollected: this.foodsCollected.get(p.id) || 0,
      rank: index + 1
    }));

    // Log the final aggregate to the file BEFORE attempting DB save
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify({ event: "MATCH_END_STATS", matchData, matchPlayers }) + '\n', { encoding: 'utf-8' });
    } catch (e) {
      console.error("[MatchLogger] Failed to write end stats to backup file:", e);
    }

    // Save to DB
    const success = await SupabaseService.saveMatch(matchData, matchPlayers, this.questionLogs);

    if (success) {
      // Remove backup log file on successful DB commit
      try {
        if (fs.existsSync(this.logFilePath)) {
          fs.unlinkSync(this.logFilePath);
        }
      } catch (e) {
        console.error("[MatchLogger] Failed to delete backup file:", e);
      }
    } else {
      console.warn(`[MatchLogger] Match data kept in ${this.logFilePath} due to DB save failure.`);
    }
    
    return {
      matchData,
      matchPlayers
    };
  }
}
