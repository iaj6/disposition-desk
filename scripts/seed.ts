/* Push the Ilmenau dataset into a Sanity dataset. Needs NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN. */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { seedDocuments } = await import("../content/seed");
  const { sanityClient } = await import("../lib/sanity");
  const client = sanityClient({ write: true });
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("SANITY_API_WRITE_TOKEN is required to seed");

  // Two passes so references resolve regardless of order: create stubs, then full docs.
  const stub = client.transaction();
  for (const d of seedDocuments) stub.createIfNotExists({ _id: d._id, _type: d._type });
  await stub.commit();

  const full = client.transaction();
  for (const d of seedDocuments) full.createOrReplace(d as never);
  const res = await full.commit();
  console.log(`Seeded ${seedDocuments.length} documents into ${client.config().projectId}/${client.config().dataset} (tx ${res.transactionId})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
