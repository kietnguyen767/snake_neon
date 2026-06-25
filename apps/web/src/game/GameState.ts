import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class SnakeSegment extends Schema {
  x: number = 0;
  y: number = 0;
}
type("number")(SnakeSegment.prototype, "x");
type("number")(SnakeSegment.prototype, "y");

export class Player extends Schema {
  id: string = "";
  name: string = "";
  score: number = 0;
  x: number = 0;
  y: number = 0;
  direction: string = "right"; 
  state: string = "MOVING"; 
  segments = new ArraySchema<SnakeSegment>();
  hasShield: boolean = false;
}
type("string")(Player.prototype, "id");
type("string")(Player.prototype, "name");
type("number")(Player.prototype, "score");
type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("string")(Player.prototype, "direction");
type("string")(Player.prototype, "state");
type([ SnakeSegment ])(Player.prototype, "segments");
type("boolean")(Player.prototype, "hasShield");

export class Food extends Schema {
  id: string = "";
  x: number = 0;
  y: number = 0;
  type: number = 1;
}
type("string")(Food.prototype, "id");
type("number")(Food.prototype, "x");
type("number")(Food.prototype, "y");
type("number")(Food.prototype, "type");

export class GameState extends Schema {
  players = new MapSchema<Player>();
  foods = new MapSchema<Food>();
  phase: number = 0; 
  hostId: string = "";
  countdown: number = 3;
  timeRemaining: number = 600;
}
type({ map: Player })(GameState.prototype, "players");
type({ map: Food })(GameState.prototype, "foods");
type("number")(GameState.prototype, "phase");
type("string")(GameState.prototype, "hostId");
type("number")(GameState.prototype, "countdown");
type("number")(GameState.prototype, "timeRemaining");
