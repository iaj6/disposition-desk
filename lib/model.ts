import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { execSync } from "node:child_process";

/**
 * DISPOSITION_MODEL selects provider and model:
 *   anthropic/claude-opus-5   (default)  — ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or the local `ant auth login` profile
 *   vertex/gemini-2.5-pro                — Google ADC; GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION
 */
export const MODEL_SPEC = process.env.DISPOSITION_MODEL ?? "anthropic/claude-opus-5";

function anthropicProvider() {
  if (process.env.ANTHROPIC_API_KEY) return createAnthropic();
  let token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) {
    try {
      token = execSync("ant auth print-credentials --access-token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      throw new Error("No Anthropic credentials: set ANTHROPIC_API_KEY, or run `ant auth login`.");
    }
  }
  return createAnthropic({ authToken: token, headers: { "anthropic-beta": "oauth-2025-04-20" } });
}

function vertexProvider() {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) throw new Error("GOOGLE_VERTEX_PROJECT is required for vertex/* models");
  // ADC's quota project may point elsewhere; Vertex 403s unless the quota project matches.
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= project;
  return createVertex({ project, location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1" });
}

export function model() {
  const [provider, ...rest] = MODEL_SPEC.split("/");
  const id = rest.join("/");
  switch (provider) {
    case "anthropic":
      return anthropicProvider()(id);
    case "vertex":
      return vertexProvider()(id);
    default:
      throw new Error(`Unknown provider in DISPOSITION_MODEL: ${MODEL_SPEC}`);
  }
}
