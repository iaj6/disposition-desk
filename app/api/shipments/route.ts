import { contentSource } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await contentSource().query(/* groq */ `*[_type == "shipment"] | order(departedAt desc){
    shipmentId, status, alarmReason, departedAt, "product": product->name, "productCode": product->code, "lane": lane->code, "packout": packout->code
  }`);
  return Response.json({ source: contentSource().name, shipments: rows });
}
