import { defineField, defineType } from "sanity";

export const shipment = defineType({
  name: "shipment",
  title: "Shipment",
  type: "document",
  fields: [
    defineField({ name: "shipmentId", type: "string", validation: (r) => r.required() }),
    defineField({ name: "product", type: "reference", to: [{ type: "product" }], validation: (r) => r.required() }),
    defineField({ name: "lane", type: "reference", to: [{ type: "lane" }], validation: (r) => r.required() }),
    defineField({ name: "packout", type: "reference", to: [{ type: "packout" }] }),
    defineField({ name: "lotNumber", type: "string" }),
    defineField({ name: "units", type: "number" }),
    defineField({ name: "payloadFillPct", type: "number" }),
    defineField({ name: "departedAt", type: "datetime" }),
    defineField({ name: "arrivedAt", type: "datetime" }),
    defineField({ name: "loggerId", type: "string" }),
    defineField({ name: "alarmReason", title: "Alarm as raised by the monitoring platform", type: "string" }),
    defineField({ name: "status", type: "string", options: { list: ["in-transit", "delivered", "on-hold", "released", "rejected"] } }),
    defineField({
      name: "readings",
      title: "Logger trace",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "at", type: "datetime" },
            { name: "tempC", type: "number" },
          ],
          preview: { select: { at: "at", t: "tempC" }, prepare: ({ at, t }) => ({ title: `${t} °C`, subtitle: at }) },
        },
      ],
    }),
  ],
  preview: { select: { title: "shipmentId", subtitle: "lane.code" } },
});
