import { defineField, defineType } from "sanity";

export const stabilityProfile = defineType({
  name: "stabilityProfile",
  title: "Stability profile",
  type: "document",
  description: "One version of a product's excursion allowances, derived from a stability summary report.",
  fields: [
    defineField({ name: "product", type: "reference", to: [{ type: "product" }], validation: (r) => r.required() }),
    defineField({ name: "version", title: "Version", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "status",
      type: "string",
      options: { list: ["effective", "superseded", "draft"] },
      validation: (r) => r.required(),
    }),
    defineField({ name: "effectiveDate", type: "date" }),
    defineField({ name: "supersedes", type: "reference", to: [{ type: "stabilityProfile" }] }),
    defineField({ name: "labelMinC", title: "Label min °C", type: "number", validation: (r) => r.required() }),
    defineField({ name: "labelMaxC", title: "Label max °C", type: "number", validation: (r) => r.required() }),
    defineField({
      name: "excursionMaxC",
      title: "Stability-supported ceiling °C",
      type: "number",
      description: "Above this transient temperature the product is presumed compromised regardless of remaining budget.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "torBudgetHours",
      title: "Cumulative time-out-of-refrigeration budget (h)",
      type: "number",
      validation: (r) => r.required(),
    }),
    defineField({ name: "mktLimitC", title: "MKT limit °C", type: "number", validation: (r) => r.required() }),
    defineField({ name: "heatOfActivationKJ", title: "ΔH (kJ/mol) for MKT", type: "number" }),
    defineField({ name: "studyRef", title: "Stability study reference", type: "string" }),
    defineField({
      name: "sourceDocument",
      title: "Source document",
      type: "reference",
      to: [{ type: "controlledDocument" }],
      description: "The stability summary this profile was transcribed from.",
    }),
    defineField({ name: "notes", type: "text", rows: 3 }),
  ],
  preview: {
    select: { product: "product.name", version: "version", status: "status" },
    prepare: ({ product, version, status }) => ({ title: `${product} — ${version}`, subtitle: status }),
  },
});
