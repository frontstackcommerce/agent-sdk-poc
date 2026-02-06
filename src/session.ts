import fs from "node:fs";
import path from "node:path";

export function saveSessionInfo(sessionId: string, transcriptPath: string): void {
  fs.writeFileSync(path.join(import.meta.dirname, 'agent-session.json'), JSON.stringify({
    sessionId,
    transcriptPath
  }));
}

export function getSessionId(): string
{
  const filePath = path.join(import.meta.dirname, 'agent-session.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath).toString()).sessionId ?? '';
  }

  return '';
}

export function getTranscriptPath(): string
{
  const filePath = path.join(import.meta.dirname, 'agent-session.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath).toString()).transcriptPath ?? '';
  }

  return '';
}
