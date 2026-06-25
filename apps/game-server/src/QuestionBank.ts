import fs from "fs";
import path from "path";

export type Question = {
  id: string;
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correct_answer: 'a' | 'b' | 'c' | 'd';
  difficulty: number;
};

// Load from JSON file
export let QUESTION_BANK: Question[] = [];
try {
  const jsonPath = path.resolve(__dirname, "questions.json");
  if (fs.existsSync(jsonPath)) {
    const data = fs.readFileSync(jsonPath, "utf-8");
    QUESTION_BANK = JSON.parse(data);
    console.log(`[QuestionBank] Loaded ${QUESTION_BANK.length} questions from JSON.`);
  } else {
    console.warn("[QuestionBank] questions.json not found! Using empty bank.");
  }
} catch (e) {
  console.error("[QuestionBank] Error loading questions:", e);
}

export function getRandomQuestion(difficulty: number, usedQuestionIds: Set<string>): Question | null {
  const available = QUESTION_BANK.filter(q => q.difficulty === difficulty && !usedQuestionIds.has(q.id));
  if (available.length === 0) {
    // Fallback if all used: just pick any from difficulty
    const fallback = QUESTION_BANK.filter(q => q.difficulty === difficulty);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}
