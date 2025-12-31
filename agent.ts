import { query, Options, SDKUserMessage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import fs from "node:fs";

const AGENT_OPTIONS: Options = {
  systemPrompt:
    fs.readFileSync(path.join(import.meta.dirname, 'sub-agents', 'buddy.md'), 'utf8'),
  tools: ["Read", "Edit", "Glob", "Task", "Write", "list_projects"],
  allowedTools: ["Read", "Edit", "Glob", "Task", "Write", "list_projects"],
  mcpServers: {
    "frontic": {
      "url": "https://mcp.frontstack.test",
      "type": "http",
      "headers": {
        "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjAxOjQ4OjI3OmI4OmJhOjVlOjFhOmNiOjk1OjAxOjRlOmI4OjM1OjkzOjJmOjFiIiwidHlwIjoiSldUIn0.eyJhdWQiOltdLCJhenAiOiJlZDNkY2QyZTQ1NGE0NzU4OTlmYjc3ZmFhNWE5OTliZSIsImVtYWlsIjoiZG9tQGZyb250c3RhY2suZGV2IiwiZXhwIjoxNzY3MjA0OTU5LCJmZWF0dXJlX2ZsYWdzIjp7ImludGVncmF0aW9uLWFrZW5lbyI6eyJ0IjoiYiIsInYiOnRydWV9LCJpbnRlZ3JhdGlvbi1jb21tZXJjZXRvb2xzIjp7InQiOiJiIiwidiI6dHJ1ZX0sInJlbGVhc2UiOnsidCI6ImIiLCJ2Ijp0cnVlfSwic3R1ZGlvIjp7InQiOiJiIiwidiI6dHJ1ZX19LCJpYXQiOjE3NjcxMTg1NTksImlzcyI6Imh0dHBzOi8vaWQuZnJvbnRsYWIuZGV2IiwianRpIjoiOWQwNTFhNjctOTUyMS00NGUxLThiYWYtZTNlMDA5MWYwNTVhIiwib3JnX2NvZGUiOiJvcmdfMTRjZDlmMTE1NjlhN2QiLCJvcmdfbmFtZSI6IlF1YW50dW0gVmVudHVyZXMiLCJwZXJtaXNzaW9ucyI6WyJwcm9qZWN0LXJlbGVhc2U6dXBzZXJ0Iiwic3RvcmFnZTpyZWFkIiwic3R1ZGlvOnJlYWQiLCJzdHVkaW86dXBzZXJ0IiwicHJvamVjdC1sb2NhbGU6cmVhZCIsInN0dWRpbzpkZWxldGUiLCJwcm9qZWN0LWZpZWxkOmRlbGV0ZSIsInByb2plY3QtZmllbGQ6cmVhZCIsInByb2plY3QtcmVsZWFzZTpyZWFkIiwiYmxvY2s6dXBzZXJ0IiwiaW50ZWdyYXRpb246dXBzZXJ0IiwicHJvamVjdDp1cHNlcnQiLCJ1c2VyOnVwc2VydCIsInByb2plY3QtZmllbGQ6dXBzZXJ0IiwicHJvamVjdC1kb21haW46dXBzZXJ0Iiwic3RvcmFnZTp1cHNlcnQiLCJpbnRlZ3JhdGlvbjpyZWFkIiwicHJvamVjdDpyZWFkIiwic2V0dGluZzpyZWFkIiwic3RvcmFnZTpicm93c2UiLCJzdG9yYWdlOmRlbGV0ZSIsInN5bmM6cmVhZCIsInVzZXI6cmVhZCIsInByb2plY3QtZG9tYWluOnJlYWQiLCJwcm9qZWN0LWRvbWFpbjpkZWxldGUiLCJibG9jazpyZWFkIiwicHJvamVjdC1sb2NhbGU6dXBzZXJ0Iiwic3luYzp1cHNlcnQiLCJibG9jazpkZWxldGUiLCJyb3V0ZXI6dXBzZXJ0Iiwicm91dGVyOnJlYWQiLCJyb3V0ZXI6ZGVsZXRlIiwic2VjcmV0OnJlYWQiLCJzZWNyZXQ6dXBzZXJ0Iiwic3R1ZGlvLWRvYzpkZWxldGUiLCJzdHVkaW8tZG9jOnVwc2VydCIsInN0dWRpby1kb2M6cmVhZCIsInN0dWRpby1jaGF0OnJlYWQiLCJzdHVkaW8tY2hhdDp1cHNlcnQiLCJzdHVkaW8tY2hhdDpkZWxldGUiLCJzdHVkaW8tam9iOnVwc2VydCIsInN0dWRpby1qb2I6cmVhZCIsInN0dWRpby1qb2I6ZGVsZXRlIiwic3R1ZGlvLXJlcG86dXBzZXJ0Iiwic3R1ZGlvLXJlcG86cmVhZCIsInN0dWRpby1yZXBvOmRlbGV0ZSIsInJlbGVhc2U6dXBzZXJ0IiwicmVsZWFzZTpyZWFkIiwic3R1ZGlvLXNldHRpbmdzOnJlYWQiLCJzdHVkaW8tc2V0dGluZ3M6dXBzZXJ0Iiwic3R1ZGlvLWRvYzpnbG9iYWwiLCJidWlsZGVyLXBhZ2VzOnJlYWQiLCJidWlsZGVyLXBhZ2VzOnVwc2VydCIsImJ1aWxkZXItcGFnZXM6ZGVsZXRlIiwiZGF0YS1zeW5jOnJlYWQiLCJkYXRhLXN5bmM6dXBzZXJ0Il0sInJvbGVzIjpbeyJpZCI6IjAxODliNzBlLTllZmEtZGFiYi1kMDA4LTRjOTQ0MjYwZDgyZCIsImtleSI6Im9yZy1hZG1pbiIsIm5hbWUiOiJBZG1pbiJ9XSwic2NwIjpbIm9wZW5pZCIsInByb2ZpbGUiLCJlbWFpbCIsIm9mZmxpbmUiXSwic3ViIjoia3BfYzU0MDgyMzhkNjU1NGQwZjhhMDM0NGZkM2M0NjQwODIifQ.v9JZjOuao3r-zVd-Vo4lvw5_lm--8Eu7FV5JyePXzNTVctNjnTEN1Z5EASFSRpRnuafjxRVgzCthb6fp1RsZocqgWi2LhjfP9EJCeYNAg9jg5WvYH9ZToKLM73nw9_KQ2e67by7XNDpY5rvwXCV313KVUb_C9jDyAGGzKY03ouXAD2tuf6XldRG2CdZnOwbDmb4QXFMFS2leFTmxkTXSRIuHsc_znxjElnxI25M8cJac1opD8RYHBA3F0Qd5Q9Uw5E2E6XtmqT44lRllIK0AhYnL1R8mivxPqLIEUXPHyHXzxsHideTAcaWuELkYDnLUwvKsAxU0iBxoKDLFZ1qHvQ",
      }
    }
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
      tools: ["Read", "Edit", "Glob", "Write", "Bash"],
    },
  },
  cwd: './workdir',
  // resume: 'f4dbf5a9-44c8-4d15-8de2-fc9d2ee8a7e3', // Resume with a previous conversation UUID
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
      if (block.type === "tool_use" && block.name === "Task") {
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
    if(message.subtype === 'success') {
      // console.log(message.result); // This is already printed curing streaming of partial messages
    } else {
      console.log(message.errors);
    }
    printPriceSummary(message);
  }
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
