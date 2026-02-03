import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";

let chatMessage: { role: string; content: string }[] = []
let count = 0;

class ConnectionManager {
  private clients: Set<ws>;

  constructor() {
      this.clients = new Set();
  }

  addClient(ws: ws) {
      this.clients.add(ws);
      console.log(`Client added. Total clients: ${this.clients.size}`);
  }

  removeClient(ws: ws) {
      this.clients.delete(ws);
      console.log(`Client removed. Total clients: ${this.clients.size}`);
  }

  broadcast(message: string, sender: ws | null = null) {
      this.clients.forEach(client => {
          if (client !== sender && client.readyState === client.OPEN) {
              try {
                  client.send(message);
              } catch (error) {
                  console.error('Error broadcasting to client:', error);
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
app.get("/", (req, res) => {
  res.send("Hello World!");
});

/**
 * Handles user messages and writes them to the stream
 */
app.post("/chat", (req, res) => {
  const userMessage = req.body.message;
  chatMessage.push({
    role: "user",
    content: userMessage,
  });
  count++;
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

  // Send welcome message
  ws.send('Welcome to the WebSocket server!');

  connectionManager.addClient(ws);
  ws.send(`Welcome! There are ${connectionManager.getClientCount()} clients connected.`);

  // Notify other clients about new connection
  connectionManager.broadcast(`A new user joined the chat!`, ws);

  ws.on('close', function close(code, reason) {
    connectionManager.removeClient(ws);
    connectionManager.broadcast(`A user left the chat.`);
  });

  ws.on('error', function error(err) {
      console.error('WebSocket error:', err);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
