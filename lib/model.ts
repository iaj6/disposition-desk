import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";

/**
 * DISPOSITION_MODEL selects provider and model:
 *   anthropic/claude-opus-5   (default)  — needs ANTHROPIC_API_KEY
 *   vertex/gemini-2.5-pro                — Google ADC; GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION
 */
export const MODEL_SPEC = process.env.DISPOSITION_MODEL ?? "anthropic/claude-opus-5";

export class ModelConfigError extends Error {}

function anthropicProvider() {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new ModelConfigError(
      "No model credentials. Put ANTHROPIC_API_KEY in .env.local, or set DISPOSITION_MODEL=vertex/<model> with GOOGLE_VERTEX_PROJECT and Google application-default credentials.",
    );
  return createAnthropic();
}

function vertexProvider() {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) throw new ModelConfigError("GOOGLE_VERTEX_PROJECT is required for vertex/* models.");
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
      throw new ModelConfigError(`Unknown provider in DISPOSITION_MODEL: ${MODEL_SPEC}`);
  }
}
