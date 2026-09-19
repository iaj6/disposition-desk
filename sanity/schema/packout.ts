import { defineField, defineType } from "sanity";

export const packout = defineType({
  name: "packout",
  title: "Packout (shipper configuration)",
  type: "document",
  fields: [
    defineField({ name: "code", type: "string", validation: (r) => r.required() }),
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "kind", type: "string", options: { list: ["passive", "active", "hybrid"] } }),
    defineField({ name: "manufacturer", type: "string" }),
    defineField({ name: "payloadVolumeL", title: "Payload volume (L)", type: "number" }),
    defineField({
      name: "currentQualification",
      title: "Current qualification",
      type: "reference",
      to: [{ type: "packoutQualification" }],
      validation: (r) => r.required(),
    }),
    defineField({ name: "packingInstruction", title: "Packing instruction (doc)", type: "reference", to: [{ type: "controlledDocument" }] }),
  ],
  preview: { select: { title: "name", subtitle: "code" } },
});
