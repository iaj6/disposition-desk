import { defineField, defineType } from "sanity";

export const controlledDocument = defineType({
  name: "controlledDocument",
  title: "Controlled document",
  type: "document",
  description: "SOPs, work instructions, stability summaries, qualification reports, carrier terms, regulatory digests. The prose the Knowledge Base compiles.",
  fields: [
    defineField({ name: "docId", type: "string", validation: (r) => r.required() }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "docType",
      type: "string",
      options: {
        list: [
          "sop",
          "work-instruction",
          "stability-summary",
          "qualification-report",
          "carrier-terms",
          "lane-risk-assessment",
          "regulatory-digest",
          "packing-instruction",
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "version", type: "string", validation: (r) => r.required() }),
    defineField({ name: "status", type: "string", options: { list: ["effective", "superseded", "draft", "external"] }, validation: (r) => r.required() }),
    defineField({ name: "effectiveDate", type: "date" }),
    defineField({ name: "supersedes", type: "reference", to: [{ type: "controlledDocument" }] }),
    defineField({ name: "owner", title: "Owning function", type: "string" }),
    defineField({ name: "summary", type: "text", rows: 3 }),
    defineField({ name: "body", title: "Body (Markdown)", type: "text", rows: 40 }),
  ],
  preview: {
    select: { docId: "docId", title: "title", version: "version", status: "status" },
    prepare: ({ docId, title, version, status }) => ({ title: `${docId} ${version} — ${title}`, subtitle: status }),
  },
});
