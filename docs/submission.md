*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

**Disposition Desk** drafts the Quality Assurance (QA) decision on a pharmaceutical shipment that arrived with a temperature alarm.

When a box of a 2–8 °C biologic shows up having spent thirty hours at 13 °C, somebody in QA has to decide whether to release it, quarantine it, or reject it. The numbers are the easy part: mean kinetic temperature (MKT), hours out of range, how much of the product's excursion budget (its allowed hours out of range over its life) is gone. The hard part is knowing which document governs, because a real quality binder disagrees with itself:

- The procedure's appendix still quotes the *superseded* stability allowance (24 hours). The effective stability summary says 48.
- The same appendix caps the product at 25 °C. The effective summary raised the ceiling to 30 °C.
- The lane (route) risk assessment assumes the insulated shipper holds temperature for 120 hours. The shipper's current qualification report proved 96, and only when it is at least 60 % full.
- A warehouse work instruction lets the receiving team release a shipment on MKT alone. The governing procedure and the US Pharmacopeia chapter on excursions (USP <1079.2>) forbid that on a route with prior excursions.
- The carrier contract allows 8 hours on the tarmac. The internal procedure escalates at 4.

A keyword search returns all of those and lets the model pick one. Filtering by document status doesn't help either: the procedure and the lane assessment are both *effective* documents, and both quote superseded numbers. Effective documents cite each other's stale figures all the time. What resolves it is the graph: every product points to its *current* stability profile, which points to the summary it was transcribed from; every packout (the box-and-coolant configuration) points to its *current* qualification; every route points to its risk assessment and carrier; every past deviation points to its route and product. Plus one document, the hierarchy procedure, that says which class of document wins when two disagree: evidence over derived, effective over superseded, procedure over work instruction, stricter regulation over internal rule.

The agent gets the governing version because the content knows which version governs. Then it shows the losing claim next to the winner, with both citations and the rule it applied.

I built it for a hypothetical drug company, Ilmenau Therapeutics GmbH, with three products, four routes, four shipments on hold, and seventeen controlled documents (procedures, stability summaries, qualification reports, carrier terms, regulatory digests) that contradict each other in the five places above. Everything about the company is invented. The domain isn't; I work in pharma cold chain.

What a person does with it: pick a shipment from the work queue, read the memo, expand any tool call to see exactly what was queried, and open the Studio to change a stability profile and watch the disposition change.

| Shipment | Situation | Result |
|---|---|---|
| SHP-26-0911 | Kestrelin, 30 h at ~13 °C in Atlanta, clean route, box only 45 % full | **RELEASE (provisional)** under the effective profile. Would be REJECT/INVESTIGATE under the superseded one the procedure's appendix still quotes. |
| SHP-26-0874 | Kestrelin, 5 h on the tarmac in Boston, every number passes, two prior deviations on the route | **ESCALATE** with corrective action. The receiving team's work instruction would have released it. |
| SHP-26-0902 | Vantrexa (an mRNA product), active container died in Singapore customs, 20 h warm | **REJECT/INVESTIGATE**, 167 % of a 12-hour budget |
| SHP-26-0920 | Orvane tablets, 2 h on a loading dock | **RELEASE (provisional)** |

## Demo

**Live:** https://disposition-desk.vercel.app — pick a shipment from the queue. Each run takes one to two minutes.

![Walkthrough of SHP-26-0874: the temperature trace, the tool calls into Sanity Context and the Knowledge Base, and the memo with its contradictions cited](https://raw.githubusercontent.com/iaj6/disposition-desk/main/docs/demo.gif)

Two shipments to try: SHP-26-0911 for the version conflict (same temperature log, opposite answer under the old profile) and SHP-26-0874 for the route that keeps failing (numbers pass, still escalated). Locally, `npm run ask -- "Assess shipment SHP-26-0874"` runs the full agent from the command line.

## Code

https://github.com/iaj6/disposition-desk

## How I Used Sanity

**The content model.** Nine document types in one dataset: `product`, `stabilityProfile`, `packout`, `packoutQualification`, `carrier`, `lane`, `shipment`, `deviation`, `controlledDocument`. Every "which version governs" question is a reference, not a search: `product.currentStabilityProfile`, `packout.currentQualification`, `lane.riskAssessment`, `controlledDocument.supersedes`. Controlled documents carry `version`, `status` (effective, superseded, draft, external), `effectiveDate` and a Markdown body. Temperature logs live on the shipment as an array of readings.

**What Sanity Context was pointed at.** The Knowledge Base source is the dataset itself, through a GROQ projection that unfolds the governing references and drops the temperature readings (a few hundred samples per shipment are noise to a Knowledge Base builder). Purpose statement: "Help QA decide the disposition of a temperature excursion on an Ilmenau Therapeutics shipment."

The build produced 13 entries and, without being told they were there, raised three of my five planted contradictions as issues for a human to resolve:

![Sanity Context issues after the first build: the 48 h vs 24 h budget, the 30 °C vs 25 °C ceiling, and the 96 h vs 120 h hold time](https://raw.githubusercontent.com/iaj6/disposition-desk/main/docs/kb-issues.png)

The two it didn't flag are conflicts between document classes rather than the same fact stated twice (a work instruction against a procedure, an external contract against an internal rule). The agent finds those itself from the hierarchy rules in the document-control procedure.

**Which tools.** One MCP endpoint, used in both modes:

- GROQ mode (`?mode=groq`): `initial_context`, `groq_query`, `schema_explorer`, `array_field_reader`. The agent uses these for records and metadata: versions, statuses, effective dates, what supersedes what.
- Knowledge Base mode (`?mode=knowledge_base&knowledgeBases=<id>`): `initial_context`, `knowledge_base_read`. This is the only way the agent can read prose. When the Knowledge Base is attached, the app strips `body` from every GROQ result before the model sees it, so procedure text has to come from the compiled, contradiction-resolved entries rather than raw documents.

Plus one custom tool, `assess_excursion`, which is where the structured content earns its keep. A single GROQ query expands shipment → product → current profile → source document, packout → current qualification, route → risk assessment → carrier, and counts prior deviations on the same route and product inside the procedure's 12-month look-back. The deterministic math (USP <1079> Haynes equation, time-weighted; time out of range by segment; budget consumption; a rules-based provisional disposition) runs on those numbers in tested code. Every number in the memo comes from that tool; the model is instructed never to compute one. The same temperature log is also re-run under every superseded profile, so the memo can say what the old answer would have been.

**What the agent does with it.** A typical run is `assess_excursion`, one `groq_query` for document metadata, `initial_context` on the Knowledge Base, one `knowledge_base_read` of six or seven entries, then the memo. The memo has fixed sections. First the provisional disposition and the numbers. Then the governing documents, each with version and status. Then each contradiction as claim A, claim B, which governs and by what rule, and what would have happened under the losing claim. Then the packout and route checks, what the Qualified Person (the signatory) still has to verify, and a paste-ready deviation summary.

On the repeat-excursion shipment it found four contradictions, cited the tie-break rule for each, and noted that one of the prior deviations had been wrongly released under the work instruction:

![The contradictions section of the memo for SHP-26-0874, each as claim A, claim B, which governs, and the consequence](https://raw.githubusercontent.com/iaj6/disposition-desk/main/docs/contradictions.jpg)

**Stack.** Next.js on Vercel, with the Vercel AI SDK's `ToolLoopAgent` and `@ai-sdk/mcp` for the Sanity Context client. Embedded Studio at `/studio`. Claude Opus 4.8 through the Vercel AI Gateway on the live site (with Sonnet 5 as a fallback), direct Anthropic or Gemini on Vertex locally. An offline mode runs the identical dataset through `groq-js`, so everything except the Knowledge Base build runs with no Sanity project at all (a model key is still required).

## Sanity Project Details

Project ID: `f5hwi6cp`, dataset `production` (public). Studio: https://ilmenau-disposition.sanity.studio/
