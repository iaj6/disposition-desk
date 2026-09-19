/* Write the seed dataset as NDJSON for `npx sanity dataset import`. */
import { writeFileSync } from "node:fs";
import { seedDocuments } from "../content/seed";
const out = process.argv[2] ?? "content/ilmenau.ndjson";
writeFileSync(out, seedDocuments.map((d) => JSON.stringify(d)).join("\n") + "\n");
console.log(`${seedDocuments.length} documents → ${out}`);
