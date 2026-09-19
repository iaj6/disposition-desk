import { defineField, defineType } from "sanity";

export const packoutQualification = defineType({
  name: "packoutQualification",
  title: "Packout qualification",
  type: "document",
  description: "What a qualification report actually proved for a packout: hold time against a named ambient profile.",
  fields: [
    defineField({ name: "packout", type: "reference", to: [{ type: "packout" }], validation: (r) => r.required() }),
    defineField({ name: "reportId", type: "string", validation: (r) => r.required() }),
    defineField({ name: "status", type: "string", options: { list: ["effective", "superseded", "in-progress"] } }),
    defineField({ name: "issuedDate", type: "date" }),
    defineField({ name: "validUntil", type: "date" }),
    defineField({ name: "ambientProfile", title: "Ambient profile tested", type: "string", description: "e.g. ISTA 7E summer, 'Ilmenau lane profile FRA-BOS summer'" }),
    defineField({ name: "holdHoursSummer", title: "Qualified hold time, summer profile (h)", type: "number" }),
    defineField({ name: "holdHoursWinter", title: "Qualified hold time, winter profile (h)", type: "number" }),
    defineField({ name: "minPayloadFillPct", title: "Minimum payload fill (%) for the hold time to apply", type: "number" }),
    defineField({ name: "preconditioningRequired", type: "string" }),
    defineField({ name: "sourceDocument", type: "reference", to: [{ type: "controlledDocument" }] }),
    defineField({ name: "notes", type: "text", rows: 3 }),
  ],
  preview: { select: { title: "reportId", subtitle: "packout.name" } },
});
