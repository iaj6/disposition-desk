import { defineField, defineType } from "sanity";

export const lane = defineType({
  name: "lane",
  title: "Lane",
  type: "document",
  fields: [
    defineField({ name: "code", type: "string", validation: (r) => r.required() }),
    defineField({ name: "origin", type: "string" }),
    defineField({ name: "destination", type: "string" }),
    defineField({ name: "mode", type: "string", options: { list: ["air", "road", "sea", "multimodal"] } }),
    defineField({ name: "carrier", type: "reference", to: [{ type: "carrier" }] }),
    defineField({ name: "plannedTransitHours", type: "number" }),
    defineField({ name: "approvedPackouts", type: "array", of: [{ type: "reference", to: [{ type: "packout" }] }] }),
    defineField({ name: "riskAssessment", title: "Lane risk assessment (doc)", type: "reference", to: [{ type: "controlledDocument" }] }),
    defineField({ name: "seasonalNotes", type: "text", rows: 3 }),
  ],
  preview: { select: { title: "code", subtitle: "carrier.name" } },
});
