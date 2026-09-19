*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

**Disposition Desk** drafts the QA decision on a pharmaceutical shipment that arrived with a temperature alarm.

When a box of a 2–8 °C biologic shows up having spent thirty hours at 13 °C, somebody in Quality Assurance has to decide whether to release it, quarantine it, or destroy it. The numbers are the easy part: mean kinetic temperature, hours out of range, how much of the product's excursion budget is gone. The hard part is knowing which document governs, because a real quality binder disagrees with itself:

- The SOP's appendix still quotes the *superseded* stability allowance (24 hours). The effective stability summary says 48.
- The lane risk assessment assumes the shipper holds 120 hours. The current qualification report proved 96, and only at 60 % fill.
- A warehouse work instruction lets receiving release on MKT alone. The SOP and USP <1079.2> forbid that on a lane with prior excursions.
- The carrier contract allows 8 hours on the tarmac. The internal procedure escalates at 4.

A keyword search returns all of those and lets the model pick one. Disposition Desk walks references instead. The content model has a pointer from every product to its *current* stability profile, from every packout to its *current* qualification, from every lane to its risk assessment and carrier, and from every past deviation to its lane and product. The agent gets the governing version because the content knows which version governs, and it shows the losing claim next to the winner with both citations.

I built it for a hypothetical sponsor, Ilmenau Therapeutics GmbH, with three products, four lanes, four shipments on hold, and seventeen controlled documents (SOPs, stability summaries, qualification reports, carrier terms, regulatory digests) that contradict each other in five deliberate places. Everything about the company is invented. The domain isn't; I work in pharma cold chain.

What a person does with it: pick a shipment from the work queue, read the memo, expand any tool call to see exactly what was queried, and open the Studio to change a stability profile and watch the disposition change.

## Demo

<!-- video -->

Try SHP-26-0911 for the version conflict (same trace: reject under the superseded profile, release under the effective one), or SHP-26-0874 for a lane that keeps failing (numbers pass, still escalated).

## Code

https://github.com/iaj6/disposition-desk

## How I Used Sanity

**The content model.** Nine document types in one dataset: `product`, `stabilityProfile`, `packout`, `packoutQualification`, `carrier`, `lane`, `shipment`, `deviation`, `controlledDocument`. Every "which version governs" question is a reference, not a search: `product.currentStabilityProfile`, `packout.currentQualification`, `lane.riskAssessment`, `controlledDocument.supersedes`. Controlled documents carry `version`, `status` (effective, superseded, draft, external), `effectiveDate` and a Markdown body. Logger traces live on the shipment as an array of readings.

**What Sanity Context was pointed at.** The Knowledge Base source is the dataset itself, through a GROQ projection that unfolds the governing references and drops the logger readings (a few hundred temperature samples per shipment are noise to a KB builder). Purpose statement: "Help QA decide the disposition of a temperature excursion on an Ilmenau Therapeutics shipment." The build produced 13 entries and, without being told they were there, raised three of my five planted contradictions as issues: the 24 h vs 48 h budget, the 25 °C vs 30 °C ceiling, and the 120 h vs 96 h hold time. The two it didn't flag are procedural rather than numeric (a work instruction vs an SOP, a contract vs an internal rule), and the agent finds those itself from the document hierarchy rules in SOP-QA-001.

**Which tools.** One MCP endpoint, used in both modes:

- GROQ mode (`?mode=groq`): `initial_context`, `groq_query`, `schema_explorer`, `array_field_reader`. The agent uses these for records and metadata: versions, statuses, effective dates, what supersedes what.
- Knowledge Base mode (`?mode=knowledge_base&knowledgeBases=<id>`): `initial_context`, `knowledge_base_read`. This is the only way the agent can read prose. When the KB is attached, the app strips `body` from every GROQ result before the model sees it, so the SOP text has to come from the compiled, contradiction-resolved entries rather than raw documents.

Plus one custom tool, `assess_excursion`, which is where the structured content earns its keep. A single GROQ query expands shipment → product → current profile → source document, packout → current qualification, lane → risk assessment → carrier, and counts prior deviations on the same lane and product inside the SOP's 12-month look-back. The deterministic math (USP <1079> Haynes equation, time-weighted; time out of range by segment; budget consumption; a rules-based provisional disposition) runs on those numbers in tested code. The model never computes a temperature. The same trace is also re-run under every superseded profile, so the memo can say what the old answer would have been.

**What the agent does with it.** A typical run is: `assess_excursion`, one `groq_query` for document metadata, `initial_context` on the KB, one `knowledge_base_read` of six or seven entries, then the memo. The memo has fixed sections: provisional disposition, the numbers, the governing documents with version and status, each contradiction as claim A / claim B / which governs and by what rule / what would have happened under the losing claim, packout and lane checks, what the Qualified Person still has to verify, and a paste-ready deviation summary. On the repeat-offender shipment it found four contradictions, cited the tie-break rule from SOP-QA-001 for each, and noted that one of the prior deviations had been wrongly released under the work instruction.

**Stack.** Next.js with the Vercel AI SDK's `ToolLoopAgent` and `@ai-sdk/mcp` for the Sanity Context client. Embedded Studio at `/studio`. Claude Opus 5 by default, Gemini on Vertex as an alternative. An offline mode runs the identical dataset through `groq-js` so the whole thing works with zero cloud config; only the Knowledge Base build needs the real service.

## Sanity Project Details

Project ID: `f5hwi6cp`, dataset `production` (public). Studio: https://ilmenau-disposition.sanity.studio/

## Agent Session

<!-- optional: embed a curated Claude Code session here -->
