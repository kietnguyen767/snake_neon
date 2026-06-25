import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register room
gameServer.define('game_room', GameRoom).filterBy(['roomId']);

gameServer.listen(port).then(() => {
  console.log(`[GameServer] Listening on port: ${port}`);
});
