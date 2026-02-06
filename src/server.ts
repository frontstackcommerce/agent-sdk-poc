import "dotenv/config";

import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import express from "express";
import { createServer } from "http";
import ws, { WebSocketServer } from "ws";
import { activeStream, getTranscriptPath, isInitialized, runAgent } from "./agent";
import { fetchMessages } from "./history";

type ProtocolError = {
  type: "error",
  error: string,
};

export type AskUserQuestionInput = {
  questions: {
    question: string
    header: string
    options: {
      label: string
      description: string
    }[]
    multiSelect: boolean
  }[]
  answers?: Record<string, string>
}

export type AskUserQuestionRequest = {
  type: "ask_user_question"
  data: AskUserQuestionInput
}

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

  broadcast(message: SDKMessage | ProtocolError | AskUserQuestionRequest, sender: ws | null = null) {
    this.clients.forEach(client => {
      if (client !== sender && client.readyState === client.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch {
          this.removeClient(client);
        }
      }
    });
  }

  getClientCount() {
    return this.clients.size;
  }
}

export const messages: string[] = [];
async function handleNewMessage(
  message: ws.RawData,
) {
  // TODO: Message schema validation
  // TODO: Receive image attachments in prompt

  let input = undefined;
  try {
    input = JSON.parse(message.toString());
  } catch {
    connectionManager.broadcast({ type: "error", error: "Invalid payload" })
    return;
  }

  if (input.type === 'initialize' && !isInitialized()) {
    runAgent(connectionManager, input.data);
  } else if (input.type === 'user_message') {
    if (!isInitialized()) {
      // TODO: Notify error
      connectionManager.broadcast({ type: "error", error: "Agent must be initialized before use" })
    } else {
      messages.push(input.data);
    }
  } else if (input.type === 'interrupt') {
    activeStream?.interrupt();
  }
}

export const connectionManager = new ConnectionManager();

const app = express();
const port = 8080;

app.use(express.json())

const server = createServer(app);

const wss = new WebSocketServer({
  server,
  clientTracking: true,
  path: "/",
});

wss.on("connection", async function connection(ws) {
  connectionManager.addClient(ws);

  const history = fetchMessages(getTranscriptPath());
  for await (const message of history) {
    ws.send(message);
  }

  ws.on("message", function (data: ws.RawData) {
    handleNewMessage(data);
  });

  ws.on("close", function close() {
    connectionManager.removeClient(ws);
  });

  ws.on("error", function error(err) {
    console.error("WebSocket error:", err);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
