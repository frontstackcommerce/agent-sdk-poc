import { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";
import { runAgent } from "./agent";

export class ConnectionManager {
  private clients: Set<ws>;

  constructor() {
      this.clients = new Set();
  }

  addClient(ws: ws) {
      this.clients.add(ws);
  }

  removeClient(ws: ws) {
      this.clients.delete(ws);
  }

  broadcast(message: SDKMessage, sender: ws | null = null) {
      this.clients.forEach(client => {
          if (client !== sender && client.readyState === client.OPEN) {
              try {
                  client.send(JSON.stringify(message));
              } catch (error) {
                  this.removeClient(client);
              }
          }
      });
  }

  getClientCount() {
      return this.clients.size;
  }
}

const connectionManager = new ConnectionManager();

const app = express();
const port = 8080;

app.use(express.json())

app.get("/", (req, res) => {
  res.send("Hello World!");
});

/**
 * Handles user messages and writes them to the stream
 */
app.post("/chat", (req, res) => {
  const userMessage = req.body.message;
  runAgent(userMessage, connectionManager)
});

const server = createServer(app);

const wss = new WebSocketServer({ 
  server,
  clientTracking: true,
  path: '/conversation-stream',
});

wss.on('connection', function connection(ws, request) {
  const clientIP = request.socket.remoteAddress;
  console.log(`New client connected from ${clientIP}`);

  connectionManager.addClient(ws);

  ws.on('close', function close(code, reason) {
    connectionManager.removeClient(ws);
  });

  ws.on('error', function error(err) {
      console.error('WebSocket error:', err);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
