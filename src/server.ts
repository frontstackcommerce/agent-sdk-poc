import { AbortError, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";
import { getAbortController, getTranscriptPath, runAgent } from "./agent";

import 'dotenv/config'
import { fetchMessages } from "./history";

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
  if (!userMessage) {
    return res.status(400).json({ error: 'message is required' })
  }

  try {
    runAgent(userMessage, connectionManager)
    res.json({ success: true })
  } catch (error) {
    console.error('Error running agent:', error)
    res.status(500).json({ error: 'Failed to process message', details: error })
  }

});

app.delete('/abort', (req, res) => {
  //getAbortController().abort('Aborted by user')

  res.status(501).json({ success: false })
});

const server = createServer(app);

const wss = new WebSocketServer({ 
  server,
  clientTracking: true,
  path: '/conversation-stream',
});

wss.on('connection', async function connection(ws) {
  connectionManager.addClient(ws);

  const history = fetchMessages(getTranscriptPath())
  for await (const message of history) {
    ws.send(message)
  }

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