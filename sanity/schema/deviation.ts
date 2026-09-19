import { defineField, defineType } from "sanity";

export const deviation = defineType({
  name: "deviation",
  title: "Deviation record",
  type: "document",
  description: "A prior excursion on a lane/product. Its existence is what USP <1079.2> cares about.",
  fields: [
    defineField({ name: "deviationId", type: "string", validation: (r) => r.required() }),
    defineField({ name: "shipment", type: "reference", to: [{ type: "shipment" }] }),
    defineField({ name: "lane", type: "reference", to: [{ type: "lane" }], validation: (r) => r.required() }),
    defineField({ name: "product", type: "reference", to: [{ type: "product" }], validation: (r) => r.required() }),
    defineField({ name: "openedAt", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "classification", type: "string", options: { list: ["minor", "major", "critical"] } }),
    defineField({ name: "rootCause", type: "string" }),
    defineField({ name: "outcome", type: "string" }),
    defineField({ name: "capaId", type: "string" }),
  ],
  preview: { select: { title: "deviationId", subtitle: "rootCause" } },
});
