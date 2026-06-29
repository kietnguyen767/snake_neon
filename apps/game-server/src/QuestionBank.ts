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
  const filePaths = ["questions_easy.json", "questions_medium.json", "questions_hard.json"];
  let totalLoaded = 0;
  for (const file of filePaths) {
    const jsonPath = path.resolve(__dirname, file);
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(data);
      QUESTION_BANK = QUESTION_BANK.concat(parsed);
      totalLoaded += parsed.length;
    } else {
      console.warn(`[QuestionBank] ${file} not found!`);
    }
  }
  console.log(`[QuestionBank] Loaded ${totalLoaded} questions from split JSON files.`);
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
