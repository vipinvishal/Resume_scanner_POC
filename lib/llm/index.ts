import { z } from "zod";
import { getSettings } from "../db";
import type { Settings } from "../types";
import { geminiChat, geminiModels } from "./gemini";
import { ollamaChat, ollamaModels } from "./ollama";

export interface LlmRequest {
  system: string;
  prompt: string;
  /** JSON schema the model should follow (providers that support it enforce it). */
  jsonSchema?: Record<string, unknown>;
}

export function activeModel(s: Settings = getSettings()): string {
  return s.provider === "gemini" ? s.geminiModel : s.ollamaModel;
}

export function assertConfigured(s: Settings) {
  if (s.provider === "gemini" && !s.geminiKey.trim())
    throw new Error("Gemini is selected but no API key is set. Open Settings and paste your key.");
  if (s.provider === "ollama" && !s.ollamaModel.trim())
    throw new Error("Ollama is selected but no model is chosen. Open Settings and pick a model.");
}

export async function chatRaw(req: LlmRequest, s: Settings = getSettings()): Promise<string> {
  assertConfigured(s);
  return s.provider === "gemini" ? geminiChat(s, req) : ollamaChat(s, req);
}

export async function listModels(s: Settings): Promise<string[]> {
  return s.provider === "gemini" ? geminiModels(s) : ollamaModels(s);
}

/** Pull a JSON object out of whatever the model returned (think tags, fences, chatter). */
export function extractJson(raw: string): unknown {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(t.slice(start, end + 1));
}

/** Ask the active model for JSON and validate it. One automatic retry with the error fed back. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  req: { system: string; prompt: string },
  s: Settings = getSettings(),
): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let prompt = req.prompt;
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chatRaw({ system: req.system, prompt, jsonSchema }, s);
    try {
      return schema.parse(extractJson(raw));
    } catch (e) {
      lastErr = e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message;
      prompt =
        req.prompt +
        `\n\nYour previous reply was invalid: ${lastErr}\nReturn ONLY a corrected JSON object that follows the schema exactly.`;
    }
  }
  throw new Error(`The model returned an unusable answer twice. ${lastErr.slice(0, 300)}`);
}
