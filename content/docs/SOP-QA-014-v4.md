# SOP-QA-014 v4 — Assessment and Disposition of Temperature Excursions

**Owner:** Quality Assurance · **Status:** Effective · **Effective date:** 2026-01-10 · **Supersedes:** SOP-QA-014 v3

## 1. Scope
Applies to any shipment of Ilmenau Therapeutics product where the temperature monitor reports a reading outside the labelled storage range between packing and receipt.

## 4. Governing data
4.1 An excursion is assessed against the product's **stability profile** as recorded in the Stability Register (STB- documents).

4.2 Only the stability profile with status *Effective* on the date of the excursion governs. **Appendix A of this SOP is informational** and is reproduced from the Stability Register at the time of SOP approval; where Appendix A and the Stability Register disagree, the Stability Register governs and Appendix A shall be corrected at the next revision.

4.3 The packout's qualified hold time is taken from the current Qualification Report (QR-) for that packout, not from the Lane Risk Assessment.

## 5. Calculations
5.1 Time out of range (TOR) is the cumulative duration of readings outside the labelled range, computed from the raw logger trace.

5.2 Mean Kinetic Temperature (MKT) shall be computed per USP <1079> using the Haynes equation with ΔH = 83.144 kJ/mol unless the stability profile specifies a product-specific value.

5.3 Calculations shall be reproducible from the raw trace and attached to the deviation record (ALCOA+).

## 6. Disposition logic
6.1 Any reading above the stability-supported ceiling → **Reject**; MKT is not applicable.

6.2 Cumulative TOR (including budget already consumed on prior legs) above the profile's budget → **Quarantine and investigate**.

6.3 **Repeat excursions.** Where one or more deviations have been recorded for the same lane and product within the preceding 12 months, MKT shall **not** be used to justify release. The shipment shall be escalated to a deviation with CAPA and the lane placed under review (USP <1079.2>, "system not in a state of control").

6.4 Where none of 6.1 to 6.3 apply and MKT is within the profile's MKT limit → provisional release, subject to Qualified Person review and signature.

## 7. Roles
Logistics may compute and record the numbers. **Only QA may disposition.**

## Appendix A — Product excursion allowances (informational, see 4.2)

| Product | Label range | Ceiling | Cumulative TOR budget | MKT limit |
|---|---|---|---|---|
| ILM-201 Kestrelin | 2–8 °C | 25 °C | 24 h | 25 °C |
| ILM-330 Vantrexa (thawed) | 2–8 °C | 25 °C | 12 h | 8 °C |
| ILM-118 Orvane | 15–25 °C | 40 °C | 168 h | 30 °C |
