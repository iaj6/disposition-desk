# Disposition Desk

![Walkthrough: pick a shipment, the desk computes the numbers, reads the Knowledge Base, and drafts the memo with every contradiction cited](docs/demo.gif)

A temperature-excursion disposition agent for a hypothetical pharma sponsor, **Ilmenau Therapeutics GmbH**, built for the [Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16) (Path One: an agent that queries real content through Sanity Context MCP).

When a shipment of a 2–8 °C biologic arrives with a temperature alarm, someone in QA has to decide: release, quarantine, or reject. The numbers (mean kinetic temperature, hours out of range, budget consumed) are easy. The hard part is knowing **which document governs**, because the quality binder disagrees with itself:

- The SOP's appendix still quotes the *superseded* stability allowance (24 h). The effective stability summary says 48 h.
- The SOP's appendix also caps the product at 25 °C. The effective summary raised the ceiling to 30 °C.
- The lane risk assessment assumes the insulated shipper holds 120 h. The current qualification report proved 96 h, and only at ≥ 60 % fill.
- A work instruction lets the warehouse release on MKT alone. The SOP and USP <1079.2> forbid that on a lane with prior excursions.
- The carrier contract allows 8 h on the tarmac. The internal SOP escalates at 4 h.

A keyword search returns all of those and lets the model pick one. Filtering by status doesn't help: the SOP and the lane assessment are both *effective* and both quote superseded numbers. This agent walks references instead: `shipment → product → currentStabilityProfile → sourceDocument`, `packout → currentQualification`, `lane → riskAssessment`, `deviation → (lane, product)`. It gets the governing version because the content model *has* a governing version, and it shows the losing claim alongside the winner with both citations.

## What it does

1. **Numbers, deterministically.** `lib/excursion.ts` computes MKT (USP <1079> Haynes equation, time-weighted), time out of range by segment, budget consumption and a rules-based provisional disposition. Pure, unit-tested, no model involved.
2. **Governance, from structured content.** One GROQ query (`lib/tools.ts`) expands every reference the assessment depends on and counts prior deviations on the same lane and product inside the SOP's 12-month look-back. The same trace is also re-run under every superseded profile so the memo can say what the old answer would have been.
3. **Contradictions, on purpose.** The model reads the governing documents through Sanity Context (GROQ mode for the entity graph, Knowledge Base mode for the compiled prose) and writes a memo that names each contradiction, applies the tie-break rules in SOP-QA-001, and lists what the Qualified Person still has to verify.

Four seeded shipments cover the decision surface:

| Shipment | Situation | Deterministic result |
|---|---|---|
| SHP-26-0911 | Kestrelin, 30 h at ~13 °C in Atlanta, clean lane, box only 45 % full | **RELEASE (provisional)** under STB-201 v3; would be REJECT/INVESTIGATE under superseded v2 (the SOP appendix still quotes v2). Below 60 % fill the qualified hold time drops from 96 h to 72 h; the 58.5 h transit is still inside it. |
| SHP-26-0874 | Kestrelin, 5 h tarmac at Boston, numbers pass, two prior deviations on the lane | **ESCALATE** with corrective action (USP <1079.2> repeat-excursion rule; the warehouse work instruction would have released it) |
| SHP-26-0902 | Vantrexa mRNA, active container died in Singapore customs, 20 h | **REJECT/INVESTIGATE** (167 % of a 12 h budget) |
| SHP-26-0920 | Orvane tablets, 2 h on a loading dock | **RELEASE (provisional)** |

## Run it

Node 24 or newer.

**No keys needed.** The dataset ships in the repo and is evaluated in-process with `groq-js`, Sanity's own GROQ engine.

```bash
npm install
npm test          # MKT invariants and disposition rules
npm run check     # the deterministic tool over all four shipments
npm run dev       # http://localhost:3050 — the work queue and shipment list work; the agent needs a model key
```

**With a model key.** Put `ANTHROPIC_API_KEY` in `.env.local` (copy `.env.example`). `DISPOSITION_MODEL=vertex/gemini-2.5-pro` with `GOOGLE_VERTEX_PROJECT` and Google ADC also works.

```bash
npm run ask -- "Assess shipment SHP-26-0874"   # full agent from the CLI, offline content
npm run dev                                     # click a shipment
```

In this mode the agent registers `groq_query` and `read_document` as stand-ins for the Sanity Context tools. Everything except the Knowledge Base build (contradiction surfacing in the Dashboard) works.

**With Sanity.**

1. `npx sanity@latest init` (writes the project id and dataset to `.env.local`), then `npm run seed`. It exports the dataset to NDJSON, imports it into the `production` dataset with your CLI login and deploys the schema. Edit the script if you named the dataset differently. (`npm run seed:token` does the same through the API with `SANITY_API_WRITE_TOKEN`.)
2. Set `SANITY_STUDIO_HOST` to a free hostname and run `npx sanity deploy`. Sanity Context's GROQ mode refuses datasets without a deployed Studio. Put the app id it prints in `SANITY_STUDIO_APP_ID` so later deploys don't prompt. The embedded Studio at `/studio` works as soon as the project id is set.
3. In the Sanity Dashboard → Context, create a Knowledge Base with the dataset as its source using the projection in `content/kb-source.groq` (purpose: "Help QA decide the disposition of a temperature excursion on an Ilmenau shipment"). Build it and resolve the issues it raises; each resolution becomes a standing instruction.
4. Create an MCP endpoint on the dataset, mint an organization token with Context Viewer, and set:

```
SANITY_CONTEXT_TOKEN=<org token>
SANITY_CONTEXT_MCP_URL=https://api.sanity.io/v1/context/organizations/<orgId>/mcp/<endpoint>?mode=groq
SANITY_CONTEXT_KB_MCP_URL=https://api.sanity.io/v1/context/organizations/<orgId>/mcp/<endpoint>?mode=knowledge_base&knowledgeBases=<kb id>
```

`npm run mcp:tools` lists the tools the endpoints serve. When both are attached the agent reads records through GROQ mode and prose only through the Knowledge Base; document bodies are stripped from GROQ results so that stays true.

## Layout

```
lib/excursion.ts        deterministic MKT / time-out-of-range / disposition (+ tests)
lib/tools.ts            assess_excursion (the reference walk), list_shipments, offline GROQ stand-ins
lib/mcp.ts              Sanity Context MCP client wiring (GROQ + Knowledge Base endpoints)
lib/agent.ts            ToolLoopAgent + the disposition instructions
lib/content.ts          ContentSource: Sanity client or in-process groq-js
sanity/schema/          product, stabilityProfile, packout, packoutQualification, carrier, lane, shipment, deviation, controlledDocument
content/seed.ts         the Ilmenau dataset (entities, generated logger traces)
content/docs/*.md       17 controlled documents with the planted contradictions
app/                    Next.js chat UI (/), API routes, embedded Studio (/studio)
scripts/                seed.ts, ask.ts (CLI), check.ts (no-model smoke test)
```

Live instance: Studio at https://ilmenau-disposition.sanity.studio/, project `f5hwi6cp`, Knowledge Base "Ilmenau Quality System" (13 entries; the build surfaced three of the five planted contradictions as issues on its own: the 24 h/48 h budget, the 25 °C/30 °C ceiling and the 120 h/96 h hold time).

Everything about Ilmenau Therapeutics, its products, carriers and documents is invented.

MIT licensed. The challenge writeup draft is in `docs/submission.md`.
