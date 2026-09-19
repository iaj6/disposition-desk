import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  },
  studioHost: "ilmenau-disposition",
  deployment: { appId: "jnqk5znruf34veaklv7jed8k", autoUpdates: true },
});
