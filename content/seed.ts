/**
 * The Ilmenau Therapeutics dataset. One hypothetical pharma sponsor, three products,
 * four lanes, four shipments, seventeen controlled documents, and the contradictions
 * a real QA binder accumulates. Everything here is invented.
 *
 * Contradictions planted on purpose (the Knowledge Base should surface each):
 *  1. SOP-QA-014 v4 Appendix A says Kestrelin TOR budget is 24 h; STB-201 v3 (effective) says 48 h.
 *  2. LRA-FRA-BOS v1 assumes PK-48 holds 120 h (from superseded QR-2023-004); QR-2025-011 proves 96 h.
 *  3. WI-LOG-007 lets receiving release on MKT alone; SOP-QA-014 §6.3 and USP <1079.2> forbid it for repeat lanes.
 *  4. Nordfracht terms allow 8 h tarmac; SOP-LOG-021 escalates at 4 h.
 *  5. LRA-FRA-BOS review was due 2026-09-12 (24 months) and cites superseded evidence → lane not approved per SOP-LOG-021 §6.3.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Reading } from "@/lib/excursion";

const DOCS_DIR = join(process.cwd(), "content", "docs");
const body = (file: string) => readFileSync(join(DOCS_DIR, file), "utf8");

export type SeedDoc = { _id: string; _type: string; [k: string]: unknown };
const ref = (id: string) => ({ _type: "reference", _ref: id });

/* ---------- deterministic logger traces ---------- */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
type Leg = { hours: number; tempC: number; jitter?: number };
function trace(startIso: string, legs: Leg[], seed: number, stepMin = 30): Reading[] {
  const rnd = lcg(seed);
  const out: Reading[] = [];
  let t = new Date(startIso).getTime();
  for (const leg of legs) {
    const n = Math.max(1, Math.round((leg.hours * 60) / stepMin));
    for (let i = 0; i < n; i++) {
      const j = (rnd() - 0.5) * 2 * (leg.jitter ?? 0.3);
      out.push({ at: new Date(t).toISOString(), tempC: Math.round((leg.tempC + j) * 10) / 10 });
      t += stepMin * 60_000;
    }
  }
  return out;
}

/* ---------- controlled documents ---------- */
type DocMeta = {
  id: string;
  file: string;
  title: string;
  docType: string;
  version: string;
  status: "effective" | "superseded" | "draft" | "external";
  effectiveDate?: string;
  supersedes?: string;
  owner: string;
  summary: string;
};
const docMeta: DocMeta[] = [
  { id: "SOP-QA-001", file: "SOP-QA-001.md", title: "Document Hierarchy and Control", docType: "sop", version: "v6", status: "effective", effectiveDate: "2025-11-01", owner: "Quality Assurance", summary: "Which document wins when two disagree: SOP over WI, effective over superseded, evidence document over derived document, stricter regulatory requirement over internal." },
  { id: "SOP-QA-014-v4", file: "SOP-QA-014-v4.md", title: "Assessment and Disposition of Temperature Excursions", docType: "sop", version: "v4", status: "effective", effectiveDate: "2026-01-10", supersedes: "SOP-QA-014-v3", owner: "Quality Assurance", summary: "The disposition procedure. §4.2 makes the Stability Register governing over the SOP's own Appendix A. §6.3 forbids MKT-based release on lanes with prior deviations. Appendix A still lists the superseded 24 h budget for Kestrelin." },
  { id: "SOP-QA-014-v3", file: "SOP-QA-014-v3.md", title: "Assessment and Disposition of Temperature Excursions", docType: "sop", version: "v3", status: "superseded", effectiveDate: "2024-04-02", owner: "Quality Assurance", summary: "Superseded version that allowed MKT-only release. Retained for traceability." },
  { id: "WI-LOG-007", file: "WI-LOG-007.md", title: "Use of Mean Kinetic Temperature at Receiving", docType: "work-instruction", version: "v2", status: "effective", effectiveDate: "2025-02-01", owner: "Logistics", summary: "Receiving-site instruction that permits release on MKT alone without a QA deviation. Written against SOP-QA-014 v3 and never updated for v4." },
  { id: "STB-201-v3", file: "STB-201-v3.md", title: "Kestrelin (ILM-201) Stability Summary and Excursion Allowances", docType: "stability-summary", version: "v3", status: "effective", effectiveDate: "2026-05-15", supersedes: "STB-201-v2", owner: "Analytical Development", summary: "Effective Kestrelin allowances: ceiling 30 °C, cumulative TOR 48 h, MKT limit 25 °C. Extended from v2 by study ILM-201-STB-07." },
  { id: "STB-201-v2", file: "STB-201-v2.md", title: "Kestrelin (ILM-201) Stability Summary and Excursion Allowances", docType: "stability-summary", version: "v2", status: "superseded", effectiveDate: "2024-03-01", owner: "Analytical Development", summary: "Superseded Kestrelin allowances: ceiling 25 °C, TOR 24 h." },
  { id: "STB-330-v1", file: "STB-330-v1.md", title: "Vantrexa (ILM-330) Thawed-State Handling and Excursion Allowances", docType: "stability-summary", version: "v1", status: "effective", effectiveDate: "2025-09-01", owner: "Analytical Development", summary: "Vantrexa thawed allowances: ceiling 25 °C, TOR 12 h, MKT limit 8 °C (MKT offers no relief for this LNP product)." },
  { id: "STB-118-v2", file: "STB-118-v2.md", title: "Orvane (ILM-118) Stability Summary and Excursion Allowances", docType: "stability-summary", version: "v2", status: "effective", effectiveDate: "2025-04-20", owner: "Analytical Development", summary: "Orvane CRT tablet allowances: ceiling 40 °C, TOR 168 h, MKT limit 30 °C." },
  { id: "QR-PK48-2025-011", file: "QR-PK48-2025-011.md", title: "Thermal Qualification of Packout PK-48 (Kestrel Passive 48 L)", docType: "qualification-report", version: "2025-011", status: "effective", effectiveDate: "2025-06-30", supersedes: "QR-PK48-2023-004", owner: "Packaging Engineering", summary: "PK-48 qualified to 96 h summer at ≥ 60 % fill (72 h below), 120 h winter. Replaces the 120 h summer figure from the 2023 report." },
  { id: "QR-PK48-2023-004", file: "QR-PK48-2023-004.md", title: "Thermal Qualification of Packout PK-48", docType: "qualification-report", version: "2023-004", status: "superseded", effectiveDate: "2023-08-14", owner: "Packaging Engineering", summary: "Superseded PK-48 qualification: 120 h summer against plain ISTA 7E, no fill sensitivity." },
  { id: "QR-PKA12-2024-002", file: "QR-PKA12-2024-002.md", title: "Operational Qualification of Active Container PK-A12 (ThermoVault A12)", docType: "qualification-report", version: "2024-002", status: "effective", effectiveDate: "2024-11-05", owner: "Packaging Engineering", summary: "Active container: 72 h battery at 35 °C, must be plugged in at ground stops over 6 h." },
  { id: "LRA-FRA-BOS-v1", file: "LRA-FRA-BOS-v1.md", title: "Lane Risk Assessment: Frankfurt → Boston, air", docType: "lane-risk-assessment", version: "v1", status: "effective", effectiveDate: "2024-09-12", owner: "Logistics", summary: "FRA→BOS lane approval. Cites 120 h packout hold (superseded QR) and 24 h product budget (superseded STB). Review was due 2026-09-12." },
  { id: "NF-TC-2025", file: "NF-TC-2025.md", title: "Nordfracht Air Cargo: Pharma Service Terms and Conditions", docType: "carrier-terms", version: "2025", status: "external", effectiveDate: "2025-01-20", owner: "Procurement", summary: "Carrier contract: tarmac exposure up to 8 h per leg; no guaranteed cool ULD storage at BOS." },
  { id: "SOP-LOG-021", file: "SOP-LOG-021.md", title: "Carrier and Lane Management", docType: "sop", version: "v3", status: "effective", effectiveDate: "2025-05-05", owner: "Logistics", summary: "Internal 4 h tarmac escalation (stricter than carrier's 8 h). A lane whose LRA is overdue or cites superseded evidence is not approved." },
  { id: "PI-PK48-v2", file: "PI-PK48-v2.md", title: "Packing Instruction: PK-48 Kestrel Passive 48 L", docType: "packing-instruction", version: "v2", status: "effective", effectiveDate: "2025-07-14", owner: "Warehouse", summary: "48 h brick pre-conditioning, ≥ 60 % fill, no dry ice." },
  { id: "REG-DIG-USP1079", file: "REG-DIG-USP1079.md", title: "Regulatory Digest: USP <1079> and <1079.2> Mean Kinetic Temperature", docType: "regulatory-digest", version: "v2", status: "effective", effectiveDate: "2025-10-01", owner: "Regulatory Affairs", summary: "MKT must not justify repeated excursions, readings above the ceiling, or non-Arrhenius products; track cumulative budget." },
  { id: "REG-DIG-EUGDP", file: "REG-DIG-EUGDP.md", title: "Regulatory Digest: EU GDP 2013/C 343/01 Chapter 9 Transportation", docType: "regulatory-digest", version: "v1", status: "effective", effectiveDate: "2024-06-01", owner: "Regulatory Affairs", summary: "Excursions must be investigated under a procedure; passive containers qualified to actual route conditions." },
];
const docs: SeedDoc[] = docMeta.map((d) => ({
  _id: `doc.${d.id}`,
  _type: "controlledDocument",
  docId: d.id.replace(/-v\d+$/, ""),
  title: d.title,
  docType: d.docType,
  version: d.version,
  status: d.status,
  effectiveDate: d.effectiveDate,
  supersedes: d.supersedes ? ref(`doc.${d.supersedes}`) : undefined,
  owner: d.owner,
  summary: d.summary,
  body: body(d.file),
}));

/* ---------- entities ---------- */
const products: SeedDoc[] = [
  { _id: "product.ilm-201", _type: "product", code: "ILM-201", name: "Kestrelin", inn: "kestrelimab 150 mg/mL", dosageForm: "solution for injection, pre-filled syringe", labelStorage: "Store at 2–8 °C. Do not freeze. Protect from light.", currentStabilityProfile: ref("stb.201.v3") },
  { _id: "product.ilm-330", _type: "product", code: "ILM-330", name: "Vantrexa", inn: "mRNA-LNP suspension, 10-dose vial", dosageForm: "suspension for injection", labelStorage: "Frozen −25 to −15 °C. Thawed: 2–8 °C up to 30 days. Do not refreeze.", currentStabilityProfile: ref("stb.330.v1") },
  { _id: "product.ilm-118", _type: "product", code: "ILM-118", name: "Orvane", inn: "orvanertinib 40 mg", dosageForm: "film-coated tablet, HDPE bottle", labelStorage: "Store at 15–25 °C.", currentStabilityProfile: ref("stb.118.v2") },
];

const profiles: SeedDoc[] = [
  { _id: "stb.201.v2", _type: "stabilityProfile", product: ref("product.ilm-201"), version: "v2", status: "superseded", effectiveDate: "2024-03-01", labelMinC: 2, labelMaxC: 8, excursionMaxC: 25, torBudgetHours: 24, mktLimitC: 25, studyRef: "ILM-201-STB-05", sourceDocument: ref("doc.STB-201-v2") },
  { _id: "stb.201.v3", _type: "stabilityProfile", product: ref("product.ilm-201"), version: "v3", status: "effective", effectiveDate: "2026-05-15", supersedes: ref("stb.201.v2"), labelMinC: 2, labelMaxC: 8, excursionMaxC: 30, torBudgetHours: 48, mktLimitC: 25, heatOfActivationKJ: 83.144, studyRef: "ILM-201-STB-07", sourceDocument: ref("doc.STB-201-v3"), notes: "Change control CC-2026-031 open to propagate 48 h to downstream documents." },
  { _id: "stb.330.v1", _type: "stabilityProfile", product: ref("product.ilm-330"), version: "v1", status: "effective", effectiveDate: "2025-09-01", labelMinC: 2, labelMaxC: 8, excursionMaxC: 25, torBudgetHours: 12, mktLimitC: 8, studyRef: "ILM-330-STB-02", sourceDocument: ref("doc.STB-330-v1"), notes: "Non-Arrhenius degradation; MKT offers no relief." },
  { _id: "stb.118.v2", _type: "stabilityProfile", product: ref("product.ilm-118"), version: "v2", status: "effective", effectiveDate: "2025-04-20", labelMinC: 15, labelMaxC: 25, excursionMaxC: 40, torBudgetHours: 168, mktLimitC: 30, studyRef: "ILM-118-STB-03", sourceDocument: ref("doc.STB-118-v2") },
];

const packouts: SeedDoc[] = [
  { _id: "packout.pk-48", _type: "packout", code: "PK-48", name: "Kestrel Passive 48 L", kind: "passive", manufacturer: "Frostwerk", payloadVolumeL: 48, currentQualification: ref("qual.pk48.2025-011"), packingInstruction: ref("doc.PI-PK48-v2") },
  { _id: "packout.pk-a12", _type: "packout", code: "PK-A12", name: "ThermoVault A12 active container", kind: "active", manufacturer: "ThermoVault", payloadVolumeL: 1200, currentQualification: ref("qual.pka12.2024-002") },
];

const qualifications: SeedDoc[] = [
  { _id: "qual.pk48.2025-011", _type: "packoutQualification", packout: ref("packout.pk-48"), reportId: "QR-PK48-2025-011", status: "effective", issuedDate: "2025-06-30", validUntil: "2027-06-30", ambientProfile: "ISTA 7E summer + Ilmenau FRA–BOS composite (4 h at 35 °C tarmac segment)", holdHoursSummer: 96, holdHoursWinter: 120, minPayloadFillPct: 60, preconditioningRequired: "48 h at 5 °C", sourceDocument: ref("doc.QR-PK48-2025-011"), notes: "Below 60 % fill the summer hold time is 72 h." },
  { _id: "qual.pk48.2023-004", _type: "packoutQualification", packout: ref("packout.pk-48"), reportId: "QR-PK48-2023-004", status: "superseded", issuedDate: "2023-08-14", ambientProfile: "ISTA 7E summer (plain)", holdHoursSummer: 120, holdHoursWinter: 144, sourceDocument: ref("doc.QR-PK48-2023-004") },
  { _id: "qual.pka12.2024-002", _type: "packoutQualification", packout: ref("packout.pk-a12"), reportId: "QR-PKA12-2024-002", status: "effective", issuedDate: "2024-11-05", validUntil: "2026-11-05", ambientProfile: "35 °C constant ambient (battery autonomy)", holdHoursSummer: 72, holdHoursWinter: 72, preconditioningRequired: "Charged to 100 %; plug in at ground stops > 6 h", sourceDocument: ref("doc.QR-PKA12-2024-002") },
];

const carriers: SeedDoc[] = [
  { _id: "carrier.nordfracht", _type: "carrier", name: "Nordfracht Air Cargo", code: "NF", gdpCertified: true, maxTarmacHours: 8, termsDocument: ref("doc.NF-TC-2025") },
  { _id: "carrier.skyline", _type: "carrier", name: "Skyline Pharma Logistics", code: "SKL", gdpCertified: true, maxTarmacHours: 6 },
  { _id: "carrier.thuringia-road", _type: "carrier", name: "Thüringer Kühltransport GmbH", code: "TKT", gdpCertified: true, maxTarmacHours: 0 },
];

const lanes: SeedDoc[] = [
  { _id: "lane.fra-bos", _type: "lane", code: "FRA-BOS", origin: "Frankfurt (FRA)", destination: "Boston (BOS)", mode: "air", carrier: ref("carrier.nordfracht"), plannedTransitHours: 52, approvedPackouts: [ref("packout.pk-48")], riskAssessment: ref("doc.LRA-FRA-BOS-v1"), seasonalNotes: "BOS ramp has no guaranteed cool ULD storage; summer tarmac dwell 2–5 h observed." },
  { _id: "lane.lej-atl", _type: "lane", code: "LEJ-ATL", origin: "Leipzig (LEJ)", destination: "Atlanta (ATL)", mode: "air", carrier: ref("carrier.nordfracht"), plannedTransitHours: 48, approvedPackouts: [ref("packout.pk-48")], seasonalNotes: "ATL import warehouse is ambient; PharmaPlus cool room must be requested per booking." },
  { _id: "lane.fra-sin", _type: "lane", code: "FRA-SIN", origin: "Frankfurt (FRA)", destination: "Singapore (SIN)", mode: "air", carrier: ref("carrier.skyline"), plannedTransitHours: 40, approvedPackouts: [ref("packout.pk-a12")], seasonalNotes: "Customs clearance at SIN can hold cargo 12–24 h; active container must be plugged in at the SATS cool chain facility." },
  { _id: "lane.ilm-erf", _type: "lane", code: "ILM-ERF", origin: "Ilmenau plant", destination: "Erfurt distribution centre", mode: "road", carrier: ref("carrier.thuringia-road"), plannedTransitHours: 3, approvedPackouts: [], seasonalNotes: "Ambient-controlled truck; 2-hour loading window in summer can exceed 25 °C." },
];

const shipments: SeedDoc[] = [
  {
    _id: "shp.26-0911", _type: "shipment", shipmentId: "SHP-26-0911", product: ref("product.ilm-201"), lane: ref("lane.lej-atl"), packout: ref("packout.pk-48"),
    lotNumber: "K26-0417", units: 1200, payloadFillPct: 45, departedAt: "2026-09-10T06:00:00Z", arrivedAt: "2026-09-12T16:30:00Z", loggerId: "FW-LV-88213", status: "on-hold",
    alarmReason: "High-temperature alarm: 30.0 h above 8 °C, peak 14.2 °C (ATL import warehouse, cool room not booked).",
    readings: trace("2026-09-10T06:00:00Z", [{ hours: 4, tempC: 5.1 }, { hours: 30, tempC: 13.2, jitter: 1.0 }, { hours: 24.5, tempC: 5.4 }], 11),
  },
  {
    _id: "shp.26-0874", _type: "shipment", shipmentId: "SHP-26-0874", product: ref("product.ilm-201"), lane: ref("lane.fra-bos"), packout: ref("packout.pk-48"),
    lotNumber: "K26-0402", units: 2400, payloadFillPct: 85, departedAt: "2026-09-04T08:00:00Z", arrivedAt: "2026-09-06T14:00:00Z", loggerId: "FW-LV-88104", status: "on-hold",
    alarmReason: "High-temperature alarm: 5.0 h above 8 °C, peak 11.4 °C (BOS tarmac dwell).",
    readings: trace("2026-09-04T08:00:00Z", [{ hours: 40, tempC: 5.0 }, { hours: 5, tempC: 10.6, jitter: 0.8 }, { hours: 9, tempC: 5.2 }], 74),
  },
  {
    _id: "shp.26-0902", _type: "shipment", shipmentId: "SHP-26-0902", product: ref("product.ilm-330"), lane: ref("lane.fra-sin"), packout: ref("packout.pk-a12"),
    lotNumber: "V26-0093", units: 9000, payloadFillPct: 70, departedAt: "2026-09-07T10:00:00Z", arrivedAt: "2026-09-09T20:00:00Z", loggerId: "TV-A12-0417", status: "on-hold",
    alarmReason: "Active container battery depleted during SIN customs hold; 20.0 h above 8 °C, peak 18.3 °C.",
    readings: trace("2026-09-07T10:00:00Z", [{ hours: 36, tempC: 4.8 }, { hours: 6, tempC: 11.5, jitter: 1.2 }, { hours: 14, tempC: 16.8, jitter: 1.4 }, { hours: 2, tempC: 5.5 }], 2),
  },
  {
    _id: "shp.26-0920", _type: "shipment", shipmentId: "SHP-26-0920", product: ref("product.ilm-118"), lane: ref("lane.ilm-erf"), packout: undefined,
    lotNumber: "O26-0211", units: 6000, payloadFillPct: 100, departedAt: "2026-09-14T11:00:00Z", arrivedAt: "2026-09-14T15:00:00Z", loggerId: "FW-LV-90011", status: "on-hold",
    alarmReason: "High-temperature alarm: 2.0 h above 25 °C, peak 27.6 °C (loading dock).",
    readings: trace("2026-09-14T11:00:00Z", [{ hours: 2, tempC: 26.9, jitter: 0.6 }, { hours: 2, tempC: 21.0 }], 20),
  },
];

const deviations: SeedDoc[] = [
  { _id: "dev.2026-0142", _type: "deviation", deviationId: "DEV-2026-0142", lane: ref("lane.fra-bos"), product: ref("product.ilm-201"), openedAt: "2026-06-02T09:00:00Z", classification: "minor", rootCause: "BOS tarmac dwell 3.5 h at 29 °C ambient; cool ULD not available", outcome: "Released on MKT per WI-LOG-007 (no QA deviation raised at the time; retrospectively logged)", capaId: undefined },
  { _id: "dev.2026-0198", _type: "deviation", deviationId: "DEV-2026-0198", lane: ref("lane.fra-bos"), product: ref("product.ilm-201"), openedAt: "2026-07-19T14:00:00Z", classification: "major", rootCause: "BOS tarmac dwell 4.8 h; brick pre-conditioning log showed 34 h (< 48 h required)", outcome: "Released after QA review; CAPA raised for pre-conditioning verification", capaId: "CAPA-2026-041" },
];

export const seedDocuments: SeedDoc[] = [...docs, ...products, ...profiles, ...packouts, ...qualifications, ...carriers, ...lanes, ...shipments, ...deviations];
