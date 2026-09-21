import { NextStudio } from "next-sanity/studio";
import config from "../../../sanity.config";

export const dynamic = "force-static";
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    return (
      <main style={{ maxWidth: 560, margin: "80px auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 20 }}>Studio needs a Sanity project</h1>
        <p>
          Set <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> and <code>NEXT_PUBLIC_SANITY_DATASET</code> in <code>.env.local</code> (or run{" "}
          <code>npx sanity init</code>), then restart the dev server. The rest of the app runs without it.
        </p>
      </main>
    );
  }
  return <NextStudio config={config} />;
}
