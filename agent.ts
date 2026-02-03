import { query, Options, SDKUserMessage, SDKMessage, PermissionResult, HookCallback, HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import fs from "node:fs";
import fronticMcp from "./mcp/fronticMcp";
import { FRONTIC_MCP_TOOLS } from "./mcp/fronticMcp";

const AGENT_SDK_MCP_TOOLS = {
  READ: "Read",
  EDIT: "Edit",
  GLOB: "Glob",
  TASK: "Task",
  WRITE: "Write",
  ASK_USER_QUESTION: "AskUserQuestion",
  SKILL: "Skill",
}

interface UserQuestion {
  question: string;
  header: string;
  options: {
    label: string;
    description: string;
  }[];
  multiSelect: boolean;
}

const sessionStartHook: HookCallback = async (input, toolUseId, options) => {
  console.log('Session start hook', input, toolUseId, options);
  return {};
}

const userPromptSubmitHook: HookCallback = async (input, toolUseId, options) => {
  console.log('User prompt submit hook', input, toolUseId, options);
  return {};
}


const AGENT_OPTIONS: Options = {
  systemPrompt:
    fs.readFileSync(path.join(import.meta.dirname, 'sub-agents', 'buddy.md'), 'utf8'),
  tools: [...Object.values(AGENT_SDK_MCP_TOOLS)],
  allowedTools: [
    // Built-in tools
    ...Object.values(AGENT_SDK_MCP_TOOLS),
    // Frontic MCP tools
    // ...Object.values(FRONTIC_MCP_TOOLS),
  ],
  mcpServers: {
    // fronticMcp
  },
  permissionMode: "acceptEdits", // plan = creates a plan file, acceptEdits = accepts the edits and returns the result
  model: "sonnet",
  includePartialMessages: true, // Enable streaming of partial messages for real-time output
  agents: {
    "frontend-engineer": {
      prompt:
        fs.readFileSync(path.join(import.meta.dirname, 'sub-agents', 'frontend-engineer.md'), 'utf8'),
      description:
        "Senior frontend engineer who writes and modifies frontend code. Use when you need to CREATE or MODIFY code files. The engineer works independently and returns results when done.",
      tools: [...Object.values(AGENT_SDK_MCP_TOOLS), "Bash"]
    },
    "api-agent": {
      prompt:
        fs.readFileSync(path.join(import.meta.dirname, 'sub-agents', 'api-agent.md'), 'utf8'),
      description:
        "API agent who creates and modifies API endpoints. Use when you need to CREATE or MODIFY API endpoints. The agent works independently and returns results when done.",
      tools: [...Object.values(AGENT_SDK_MCP_TOOLS)], // ...Object.values(FRONTIC_MCP_TOOLS)],
    },
  },
  settingSources: ['user'],
  hooks: {
    UserPromptSubmit: [{
      hooks: [userPromptSubmitHook],
    }],
  },
  cwd: './workdir',
  additionalDirectories: ['./workdir'],
  canUseTool: async (toolName, input) => {
    if (toolName === AGENT_SDK_MCP_TOOLS.ASK_USER_QUESTION) {
      return processUserQuestions(input.questions as UserQuestion[])
    }

    return {
      behavior: "allow",
      updatedInput: input,
    }
  },
  // resume: '17db92b4-f1fe-49c9-b9f3-fd4f293ee537', // Resume with a previous conversation UUID
} as const;

// State tracking for streaming output
let isStreamingText = false;

function printSdkMessage(message: SDKMessage) {

  // Handle streaming partial messages
  if (message.type === "stream_event") {
    const event = message.event;

    // Handle message start
    if (event.type === "message_start") {
      // New message is starting
      return;
    }

    // Handle content block start
    if (event.type === "content_block_start") {
      if (event.content_block?.type === "text") {
        isStreamingText = true;
      }
      return;
    }

    // Handle content block deltas (this is where we stream text)
    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta" && event.delta.text) {
        process.stdout.write(event.delta.text);
      }
      return;
    }

    // Handle content block stop
    if (event.type === "content_block_stop") {
      if (isStreamingText) {
        console.log(); // Add newline after text streaming completes
        isStreamingText = false;
      }
      return;
    }

    // Handle message stop
    if (event.type === "message_stop") {
      // Message is complete
      return;
    }

    return;
  }

  // Print human-readable output for complete messages
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if ("text" in block) {
        // Only print if we haven't already streamed it
        if (!isStreamingText) {
          console.log(block.text);
        }
      } else if ("name" in block) {
        console.log(`Tool: ${block.name}`);
        console.log(`Tool input: ${JSON.stringify(block.input)}`);
      }
      if (block.type === "tool_use" && block.name === AGENT_SDK_MCP_TOOLS.TASK) {
        // Typehint input, because it's unknown in the SDK  
        console.log(`Subagent invoked: ${(block.input as { subagent_type?: string }).subagent_type}`);
      }

      // Check if this message is from within a subagent's context
      if (message.parent_tool_use_id) {
        console.log("  (running inside subagent)");
      }

      if ("result" in message) {
        console.log(message.result);
      }
    }
  } else if (message.type === "result") {
    console.log(`Done: ${message.subtype}`); // Final result
    if (message.subtype === 'success') {
      // console.log(message.result); // This is already printed curing streaming of partial messages
    } else {
      console.log(message.errors);
    }
    printPriceSummary(message);
  } else if (message.type === "system") {
    console.log('System message:', message);
  }

  message
}

const rl = createInterface({ input, output });
let shouldContinueConversation = false;

try {
  while (true) {
    const raw = await rl.question(
      shouldContinueConversation
        ? "\nYou (type 'exit' to quit): "
        : "Enter your prompt (type 'exit' to quit): "
    );

    const userPrompt = raw.trim();
    if (!userPrompt) continue;

    const normalized = userPrompt.toLowerCase();
    if (normalized === "exit" || normalized === "quit" || normalized === "/exit") {
      break;
    }

    const userMessage: SDKUserMessage = {
      type: "user",
      message: {
        role: "user",
        content: [{
          type: "text",
          text: userPrompt,
        }],
      },
      parent_tool_use_id: null,
      session_id: crypto.randomUUID(),
    }

    const userMessageIterable = async function* () {
      yield userMessage;
    }

    // Agentic loop: streams messages as Claude works for this single user turn.
    // On subsequent turns, `continue: true` keeps the same conversation.
    for await (const message of query({
      prompt: userMessageIterable(),
      options: {
        ...AGENT_OPTIONS,
        continue: shouldContinueConversation,
      },
    })) {
      printSdkMessage(message);
    }

    shouldContinueConversation = true;
  }
} finally {
  rl.close();
}

function printPriceSummary(message: SDKMessage) {
  if (message.type !== "result") return;
  if (!message.total_cost_usd && !message.modelUsage) return;

  console.log("\n💰 Price Summary:");

  // Total tokens and cost
  if (message.usage) {
    const totalInput = (message.usage.input_tokens || 0) +
      (message.usage.cache_creation_input_tokens || 0) +
      (message.usage.cache_read_input_tokens || 0);
    const totalOutput = message.usage.output_tokens || 0;
    console.log(`   Tokens: ${totalInput.toLocaleString()} in / ${totalOutput.toLocaleString()} out`);
  }

  if (message.total_cost_usd !== undefined) {
    console.log(`   Total: $${message.total_cost_usd.toFixed(4)}`);
  }

  // Per-model breakdown
  if (message.modelUsage) {
    console.log("\n   Model breakdown:");
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      const modelName = model.replace('claude-', '').replace(/\d{8}$/, '').trim();
      const inTokens = (usage.inputTokens || 0) + (usage.cacheCreationInputTokens || 0);
      const outTokens = usage.outputTokens || 0;
      const cacheRead = usage.cacheReadInputTokens || 0;

      console.log(`   • ${modelName}: ${inTokens.toLocaleString()} in${cacheRead > 0 ? ` (+${cacheRead.toLocaleString()} cache)` : ''} / ${outTokens.toLocaleString()} out → $${usage.costUSD.toFixed(4)}`);
    }
  }
  console.log(); // Empty line after summary
}

async function processUserQuestions(questions: UserQuestion[]): Promise<PermissionResult> {

  const answers = {};

  for (const question of questions) {
    // Show indexed options and let user input indices (comma-separated for multi-select)
    console.log(`\n${question.question}`);
    const promptOptions = question.options
      .map((option, idx) => `  [${idx + 1}] ${option.label}: ${option.description}`)
      .join('\n');
    const answerInput = await rl.question(
      `${question.header}\n${promptOptions}\nSelect option${question.options.length > 1 ? '(s)' : ''} by index${question.options.length > 1 ? ' (comma-separated for multiple)' : ''}: `
    );
    // Parse user input as indices
    const selectedIndices = answerInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s)
      .map(s => parseInt(s, 10) - 1)
      .filter(idx => idx >= 0 && idx < question.options.length);

    // Support single or multiple selection - store labels of selected options
    if (selectedIndices.length > 1) {
      answers[question.question] = selectedIndices.map(idx => question.options[idx].label);
    } else if (selectedIndices.length === 1) {
      answers[question.question] = question.options[selectedIndices[0]].label;
    } else {
      answers[question.question] = null; // Or some default/fallback
    }
  }
  return {
    behavior: "allow",
    updatedInput: {
      questions,  // Pass through original questions
      answers
    }
  }
}
