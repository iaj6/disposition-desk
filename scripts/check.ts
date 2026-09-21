/* No-LLM smoke test: run the deterministic tool for every seeded shipment against the local GROQ engine. */
import { assessShipment } from "../lib/tools";
import { LocalContentSource } from "../lib/content";

const src = new LocalContentSource();
for (const id of ["SHP-26-0911", "SHP-26-0874", "SHP-26-0902", "SHP-26-0920"]) {
  const r = await assessShipment(id, src);
  const a = r.assessment;
  console.log(`${id} ${r.product.code} ${r.shipment.lane}`);
  console.log(`   ${a.disposition} | MKT ${a.mktC.toFixed(2)}/${a.mktLimitC} | TOR ${a.torOutHours.toFixed(1)}/${a.torBudgetHours} h | peak ${a.maxC}/${a.hardLimitC} | prior ${a.priorExcursionCount}`);
  console.log(`   profile ${r.governingProfile.version} ${r.governingProfile.status}; superseded: ${r.underSupersededProfiles.map((p) => `${p.version}=${p.disposition}`).join(", ") || "none"}`);
  const pk = r.packoutCheck;
  const lra = r.laneCheck.riskAssessment;
  console.log(`   packout: ${pk ? `${pk.reportId}, hold ${pk.qualifiedHoldHours} h vs transit ${pk.transitHours?.toFixed(1)} h, fill ok ${pk.fillConditionMet}` : "none"}; lane assessment: ${lra ? `${lra.docId} ${lra.version}, ${r.laneCheck.riskAssessmentAgeMonths} months old, review due ${r.laneCheck.riskAssessmentReviewDue}` : "none on file"}`);
}
