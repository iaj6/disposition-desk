/**
 * Where the agent's structured content comes from.
 *
 *  - SanityContentSource: the real Content Lake (used by the deterministic tool, which
 *    needs full logger traces and reference expansion in one round trip).
 *  - LocalContentSource: the same dataset evaluated in-process with groq-js, Sanity's own
 *    GROQ engine. Lets the whole agent run with zero cloud config, and mirrors the
 *    Sanity Context GROQ-mode tools so the offline demo exercises the same query shapes.
 */
import { evaluate, parse } from "groq-js";
import { seedDocuments, type SeedDoc } from "@/content/seed";
import { sanityClient, sanityConfigured } from "./sanity";

export interface ContentSource {
  readonly name: string;
  query<T = unknown>(groq: string, params?: Record<string, unknown>): Promise<T>;
}

export class SanityContentSource implements ContentSource {
  readonly name = "sanity";
  private client = sanityClient();
  query<T>(groq: string, params: Record<string, unknown> = {}) {
    return this.client.fetch<T>(groq, params);
  }
}

export class LocalContentSource implements ContentSource {
  readonly name = "local";
  constructor(private dataset: SeedDoc[] = seedDocuments) {}
  async query<T>(groq: string, params: Record<string, unknown> = {}): Promise<T> {
    const tree = parse(groq);
    const value = await evaluate(tree, { dataset: this.dataset, params });
    return (await value.get()) as T;
  }
}

let cached: ContentSource | undefined;
export function contentSource(): ContentSource {
  if (!cached) cached = sanityConfigured() ? new SanityContentSource() : new LocalContentSource();
  return cached;
}
