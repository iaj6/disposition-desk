import { defineField, defineType } from "sanity";

export const carrier = defineType({
  name: "carrier",
  title: "Carrier",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "code", type: "string" }),
    defineField({ name: "gdpCertified", type: "boolean" }),
    defineField({ name: "maxTarmacHours", title: "Contracted max tarmac exposure (h)", type: "number" }),
    defineField({ name: "termsDocument", type: "reference", to: [{ type: "controlledDocument" }] }),
  ],
});
