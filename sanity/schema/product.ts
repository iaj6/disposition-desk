import { defineField, defineType } from "sanity";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({ name: "code", title: "Product code", type: "string", validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "inn", title: "INN / description", type: "string" }),
    defineField({ name: "dosageForm", title: "Dosage form", type: "string" }),
    defineField({ name: "labelStorage", title: "Label storage statement", type: "string" }),
    defineField({
      name: "currentStabilityProfile",
      title: "Current (effective) stability profile",
      type: "reference",
      to: [{ type: "stabilityProfile" }],
      description: "The single governing profile. Superseded profiles stay in the dataset with status=superseded.",
      validation: (r) => r.required(),
    }),
  ],
  preview: { select: { title: "name", subtitle: "code" } },
});
