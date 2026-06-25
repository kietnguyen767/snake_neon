import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class SnakeSegment extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") score: number = 0;

  // Vị trí cái đầu
  @type("number") x: number = 0;
  @type("number") y: number = 0;

  @type("string") direction: string = "right";
  @type("string") state: string = "MOVING";

  // Khai báo thân rắn
  @type([SnakeSegment]) segments = new ArraySchema<SnakeSegment>();

  @type("boolean") hasShield: boolean = false;

  moveAccumulator: number = 0;
  speed: number = 0.35;
  questionDeadline?: number;
  pendingFoodId?: string; // Dùng để nhớ viên mồi vừa ăn
  pendingQuestionId?: string; // ID của câu hỏi đang hỏi
  stunnedUntil?: number; // Server-side timer cho trạng thái STUNNED
  speedBoostUntil?: number; // Server-side timer cho hiệu ứng tăng tốc
  shieldUntil?: number; // Server-side timer cho khiên 10 giây
}

export class Food extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") type: number = 1;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Food }) foods = new MapSchema<Food>();
  @type("number") phase: number = 0;
  @type("string") hostId: string = "";
  @type("number") countdown: number = 3;
  @type("number") timeRemaining: number = 600;
}
