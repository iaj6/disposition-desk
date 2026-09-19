import { createClient } from "@sanity/client";

export const sanityConfigured = () => Boolean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);

export function sanityClient(opts: { write?: boolean } = {}) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID is not set");
  return createClient({
    projectId,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2026-09-01",
    useCdn: false,
    perspective: "published",
    token: opts.write ? process.env.SANITY_API_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN,
  });
}
