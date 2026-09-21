import { defineCliConfig } from "sanity/cli";

// Studio hosting is per-deployer: set SANITY_STUDIO_HOST (and SANITY_STUDIO_APP_ID after the
// first `npx sanity deploy`) in .env.local rather than hardcoding them here.
const appId = process.env.SANITY_STUDIO_APP_ID;

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  },
  studioHost: process.env.SANITY_STUDIO_HOST,
  deployment: appId ? { appId, autoUpdates: true } : undefined,
});
