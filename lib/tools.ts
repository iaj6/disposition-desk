import { tool } from "ai";
import { z } from "zod";
import { contentSource, type ContentSource } from "./content";
import { assess, type Reading } from "./excursion";

/* One GROQ query walks every reference the assessment depends on. This is the point:
   the numbers are only right because the content is structured. */
const SHIPMENT_QUERY = /* groq */ `*[_type == "shipment" && shipmentId == $id][0]{
  shipmentId, lotNumber, units, payloadFillPct, departedAt, arrivedAt, loggerId, alarmReason, status,
  readings[]{ at, tempC },
  product->{
    _id, code, name, dosageForm, labelStorage,
    "profile": currentStabilityProfile->{
      _id, version, status, effectiveDate, labelMinC, labelMaxC, excursionMaxC, torBudgetHours, mktLimitC, heatOfActivationKJ, studyRef, notes,
      "sourceDocument": sourceDocument->{ docId, version, status, title }
    },
    "otherProfiles": *[_type == "stabilityProfile" && product._ref == ^._id && status != "effective"]{ version, status, effectiveDate, labelMinC, labelMaxC, excursionMaxC, torBudgetHours, mktLimitC, heatOfActivationKJ, "sourceDocument": sourceDocument->docId }
  },
  lane->{
    _id, code, origin, destination, mode, plannedTransitHours, seasonalNotes,
    carrier->{ name, maxTarmacHours, "termsDocument": termsDocument->docId },
    "riskAssessment": riskAssessment->{ docId, version, status, effectiveDate, title },
    "approvedPackoutCodes": approvedPackouts[]->code
  },
  packout->{
    code, name, kind,
    "qualification": currentQualification->{ reportId, status, issuedDate, validUntil, ambientProfile, holdHoursSummer, holdHoursSummerLowFill, holdHoursWinter, minPayloadFillPct, preconditioningRequired, notes },
    "packingInstruction": packingInstruction->docId
  },
  "priorDeviations": *[_type == "deviation" && lane._ref == ^.lane._ref && product._ref == ^.product._ref && openedAt < ^.departedAt] | order(openedAt desc){
    deviationId, openedAt, classification, rootCause, outcome, capaId
  }
}`;

type ShipmentBundle = {
  shipmentId: string;
  lotNumber?: string;
  units?: number;
  payloadFillPct?: number;
  departedAt: string;
  arrivedAt?: string;
  loggerId?: string;
  alarmReason?: string;
  status?: string;
  readings: Reading[];
  product: {
    code: string;
    name: string;
    dosageForm?: string;
    labelStorage?: string;
    profile: {
      version: string;
      status: string;
      effectiveDate?: string;
      labelMinC: number;
      labelMaxC: number;
      excursionMaxC: number;
      torBudgetHours: number;
      mktLimitC: number;
      heatOfActivationKJ?: number;
      studyRef?: string;
      notes?: string;
      sourceDocument?: { docId: string; version: string; status: string; title: string };
    };
    otherProfiles: Array<{ version: string; status: string; effectiveDate?: string; labelMinC: number; labelMaxC: number; excursionMaxC: number; torBudgetHours: number; mktLimitC: number; heatOfActivationKJ?: number; sourceDocument?: string }>;
  };
  lane: {
    code: string;
    origin?: string;
    destination?: string;
    mode?: string;
    plannedTransitHours?: number;
    seasonalNotes?: string;
    carrier?: { name: string; maxTarmacHours?: number; termsDocument?: string };
    riskAssessment?: { docId: string; version: string; status: string; effectiveDate?: string; title: string };
    approvedPackoutCodes?: string[];
  };
  packout?: {
    code: string;
    name: string;
    kind?: string;
    qualification?: { reportId: string; status: string; issuedDate?: string; validUntil?: string; ambientProfile?: string; holdHoursSummer?: number; holdHoursSummerLowFill?: number; holdHoursWinter?: number; minPayloadFillPct?: number; preconditioningRequired?: string; notes?: string };
    packingInstruction?: string;
  };
  priorDeviations: Array<{ deviationId: string; openedAt: string; classification?: string; rootCause?: string; outcome?: string; capaId?: string }>;
};

const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
const monthsBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / (30.44 * 86_400_000);

export async function assessShipment(shipmentId: string, source: ContentSource = contentSource()) {
  const s = await source.query<ShipmentBundle | null>(SHIPMENT_QUERY, { id: shipmentId });
  if (!s) throw new Error(`No shipment with shipmentId ${shipmentId}`);
  if (!s.product) throw new Error(`Shipment ${shipmentId} has no product reference`);
  if (!s.lane) throw new Error(`Shipment ${shipmentId} has no lane reference`);
  const p = s.product.profile;
  if (!p) throw new Error(`Product ${s.product.code} has no effective stability profile (currentStabilityProfile is unset)`);
  s.readings ??= [];
  s.priorDeviations ??= [];
  s.product.otherProfiles ??= [];

  // Only deviations within the SOP-QA-014 §6.3 look-back (12 months) count.
  const priorInWindow = s.priorDeviations.filter((d) => monthsBetween(d.openedAt, s.departedAt) <= 12);

  const assessment = assess(
    s.readings,
    {
      labelMinC: p.labelMinC,
      labelMaxC: p.labelMaxC,
      excursionMaxC: p.excursionMaxC,
      torBudgetHours: p.torBudgetHours,
      torPriorHours: 0,
      mktLimitC: p.mktLimitC,
      heatOfActivationKJ: p.heatOfActivationKJ,
    },
    priorInWindow.length,
  );

  // What the same trace would have produced under each superseded profile: the demo's second act.
  const underOtherProfiles = s.product.otherProfiles.map((o) => ({
    version: o.version,
    status: o.status,
    sourceDocument: o.sourceDocument,
    disposition: assess(s.readings, { labelMinC: o.labelMinC ?? p.labelMinC, labelMaxC: o.labelMaxC ?? p.labelMaxC, excursionMaxC: o.excursionMaxC, torBudgetHours: o.torBudgetHours, torPriorHours: 0, mktLimitC: o.mktLimitC, heatOfActivationKJ: o.heatOfActivationKJ }, priorInWindow.length).disposition,
    torBudgetHours: o.torBudgetHours,
    excursionMaxC: o.excursionMaxC,
  }));

  // Packout checks straight off the qualification record.
  const q = s.packout?.qualification;
  const departMonth = new Date(s.departedAt).getUTCMonth() + 1;
  const season = departMonth >= 4 && departMonth <= 10 ? "summer" : "winter";
  const transitHours = s.arrivedAt ? hoursBetween(s.departedAt, s.arrivedAt) : undefined;
  // The qualified hold time depends on season and, when the report qualified a reduced figure, on fill.
  const underFilled = q?.minPayloadFillPct !== undefined && s.payloadFillPct !== undefined && s.payloadFillPct < q.minPayloadFillPct;
  const qualifiedHold = q
    ? season === "summer"
      ? underFilled && q.holdHoursSummerLowFill !== undefined ? q.holdHoursSummerLowFill : q.holdHoursSummer
      : q.holdHoursWinter
    : undefined;
  const packoutCheck = q
    ? {
        reportId: q.reportId,
        reportStatus: q.status,
        validUntil: q.validUntil,
        qualificationExpired: q.validUntil ? new Date(q.validUntil) < new Date(s.departedAt) : false,
        season,
        qualifiedHoldHours: qualifiedHold,
        qualifiedHoldBasis: q ? (season === "summer" ? (underFilled && q.holdHoursSummerLowFill !== undefined ? `summer profile, reduced figure for fill below ${q.minPayloadFillPct} %` : underFilled ? `summer profile at full fill; the report qualified no figure for fill below ${q.minPayloadFillPct} %` : "summer profile") : "winter profile") : undefined,
        transitHours,
        transitWithinQualifiedHold: qualifiedHold !== undefined && transitHours !== undefined ? transitHours <= qualifiedHold : undefined,
        minPayloadFillPct: q.minPayloadFillPct,
        shipmentFillPct: s.payloadFillPct,
        fillConditionMet: q.minPayloadFillPct !== undefined && s.payloadFillPct !== undefined ? s.payloadFillPct >= q.minPayloadFillPct : undefined,
        qualificationNotes: q.notes,
        packoutApprovedForLane: s.lane.approvedPackoutCodes?.includes(s.packout!.code) ?? false,
      }
    : undefined;

  // Lane governance: is the LRA current? (SOP-QA-001 §4, SOP-LOG-021 §6)
  const lra = s.lane.riskAssessment;
  const laneCheck = {
    riskAssessment: lra ?? null,
    riskAssessmentAgeMonths: lra?.effectiveDate ? Math.round(monthsBetween(lra.effectiveDate, s.departedAt)) : null,
    riskAssessmentReviewOverdueAtDeparture: lra?.effectiveDate ? monthsBetween(lra.effectiveDate, s.departedAt) > 24 : null,
    riskAssessmentReviewOverdueToday: lra?.effectiveDate ? monthsBetween(lra.effectiveDate, new Date().toISOString()) > 24 : null,
    riskAssessmentReviewDue: lra?.effectiveDate ? new Date(new Date(lra.effectiveDate).setUTCMonth(new Date(lra.effectiveDate).getUTCMonth() + 24)).toISOString().slice(0, 10) : null,
    carrier: s.lane.carrier ?? null,
    plannedTransitHours: s.lane.plannedTransitHours,
    actualTransitHours: transitHours,
    seasonalNotes: s.lane.seasonalNotes,
  };

  // Downsampled trace for the UI chart (never for the model to recompute from).
  const sorted = [...s.readings].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const step = Math.max(1, Math.ceil(sorted.length / 120));
  const trace = sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1).map((r) => ({ at: r.at, tempC: r.tempC }));

  return {
    contentSource: source.name,
    trace,
    shipment: { shipmentId: s.shipmentId, lotNumber: s.lotNumber, units: s.units, status: s.status, departedAt: s.departedAt, arrivedAt: s.arrivedAt, loggerId: s.loggerId, alarmReason: s.alarmReason, lane: `${s.lane.code} (${s.lane.origin} → ${s.lane.destination}, ${s.lane.mode})`, packout: s.packout ? `${s.packout.code} ${s.packout.name}` : null },
    product: { code: s.product.code, name: s.product.name, dosageForm: s.product.dosageForm, labelStorage: s.product.labelStorage },
    governingProfile: { version: p.version, status: p.status, effectiveDate: p.effectiveDate, studyRef: p.studyRef, sourceDocument: p.sourceDocument, notes: p.notes, labelMinC: p.labelMinC, labelMaxC: p.labelMaxC, excursionMaxC: p.excursionMaxC, torBudgetHours: p.torBudgetHours, mktLimitC: p.mktLimitC },
    assessment,
    underSupersededProfiles: underOtherProfiles,
    priorDeviationsInLookback: priorInWindow,
    packoutCheck,
    laneCheck,
  };
}

export const assessExcursionTool = tool({
  description:
    "Deterministic excursion assessment for one shipment. Walks shipment → product → effective stability profile, packout → current qualification, lane → risk assessment and carrier, and counts prior deviations on the same lane+product, then computes MKT (USP <1079> Haynes equation), time-out-of-range, budget consumption and a rules-based provisional disposition. Every number the memo quotes must come from here.",
  inputSchema: z.object({ shipmentId: z.string().describe("e.g. SHP-26-0911") }),
  execute: async ({ shipmentId }) => assessShipment(shipmentId),
});

export const listShipmentsTool = tool({
  description: "List shipments currently on hold with an open temperature alarm.",
  inputSchema: z.object({}),
  execute: async () =>
    contentSource().query(/* groq */ `*[_type == "shipment" && status == "on-hold"] | order(departedAt desc){
      shipmentId, status, alarmReason, departedAt, "product": product->name, "productCode": product->code, "lane": lane->code, "packout": packout->code
    }`),
});

/* Offline stand-ins for the Sanity Context GROQ-mode tools, so the agent runs with no cloud
   config. When SANITY_CONTEXT_MCP_URL is set these are not registered; the MCP endpoint's
   own tools are used instead. */
export const localGroqTool = tool({
  description:
    "Run a GROQ query against the Ilmenau quality dataset (offline stand-in for Sanity Context groq_query). Document types: product, stabilityProfile, packout, packoutQualification, carrier, lane, shipment, deviation, controlledDocument. controlledDocument has docId, title, docType, version, status (effective|superseded|draft|external), effectiveDate, supersedes (reference), owner, summary, body (Markdown). Prefer projections; avoid returning shipment.readings.",
  inputSchema: z.object({ query: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
  execute: async ({ query, params }) => contentSource().query(query, params ?? {}),
});

export const localReadDocumentTool = tool({
  description: "Read the full Markdown body of a controlled document by docId (and optional version), e.g. SOP-QA-014 v4. Returns every version, newest first, with status and what it supersedes.",
  inputSchema: z.object({ docId: z.string(), version: z.string().optional() }),
  execute: async ({ docId, version }) =>
    contentSource().query(
      /* groq */ `*[_type == "controlledDocument" && docId == $docId ${"" /* version filter below */}] | order(effectiveDate desc){ docId, title, version, status, effectiveDate, owner, "supersedes": supersedes->{docId, version}, body }` +
        "",
      { docId },
    ).then((rows) => {
      const list = rows as Array<{ version: string }>;
      return version ? list.filter((r) => r.version === version) : list;
    }),
});
