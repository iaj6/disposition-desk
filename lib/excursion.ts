/**
 * Deterministic excursion math. Nothing here calls a model or the network.
 *
 * Under 21 CFR Part 11 / EU GMP Annex 11 the numeric basis of a disposition must be
 * reproducible and attributable, so every figure the agent quotes comes from this
 * module. The model narrates these numbers; it never invents a temperature or an MKT.
 *
 * Ported 1:1 from the Go `internal/excursion` package, including its invariant tests.
 */

export interface Reading {
  at: string; // ISO-8601
  tempC: number;
}

export interface StabilityBudget {
  labelMinC: number;
  labelMaxC: number;
  /** Highest transient temperature the stability data supports at all. */
  excursionMaxC: number;
  /** Cumulative allowed time-out-of-refrigeration across the product's life, hours. */
  torBudgetHours: number;
  /** Budget already spent on earlier legs. */
  torPriorHours: number;
  /** Max acceptable mean kinetic temperature over the assessed window. */
  mktLimitC: number;
  /** ΔH in kJ/mol; USP <1079> default 83.144 when unknown. */
  heatOfActivationKJ?: number;
}

export interface ExcursionSegment {
  direction: "high" | "low";
  start: string;
  end: string;
  hours: number;
  peakC: number;
}

export type Disposition =
  | "REJECT"
  | "ESCALATE"
  | "REJECT/INVESTIGATE"
  | "INVESTIGATE"
  | "RELEASE (provisional)";

export interface Assessment {
  readingCount: number;
  windowHours: number;
  minC: number;
  maxC: number;
  meanC: number;
  mktC: number;
  heatOfActivationKJ: number;
  labelMinC: number;
  labelMaxC: number;
  hoursAboveMax: number;
  hoursBelowMin: number;
  torOutHours: number;
  segments: ExcursionSegment[];
  torBudgetHours: number;
  torPriorHours: number;
  torRemainingHours: number;
  budgetConsumedPct: number;
  budgetExceeded: boolean;
  mktLimitC: number;
  mktExceeded: boolean;
  hardLimitC: number;
  hardLimitHit: boolean;
  priorExcursionCount: number;
  /** USP <1079.2>: MKT may NOT be used to excuse a lane with repeated excursions. */
  repeatOffender: boolean;
  disposition: Disposition;
  dispositionRationale: string;
}

const R = 8.314; // J·K⁻¹·mol⁻¹
export const DEFAULT_HEAT_OF_ACTIVATION_KJ = 83.144;
const KELVIN = 273.15;

const ms = (iso: string) => new Date(iso).getTime();

/** Hours each reading represents: the interval to the next reading; the last mirrors the prior. */
function durationWeights(rs: Reading[]): number[] {
  const w = new Array<number>(rs.length).fill(0);
  let anyPositive = false;
  for (let i = 0; i < rs.length - 1; i++) {
    const d = (ms(rs[i + 1].at) - ms(rs[i].at)) / 3_600_000;
    if (d > 0) {
      w[i] = d;
      anyPositive = true;
    }
  }
  if (!anyPositive) return w.fill(1);
  w[rs.length - 1] = w[rs.length - 2];
  return w;
}

/**
 * Time-weighted Mean Kinetic Temperature (°C) via the Haynes equation (USP <1079>):
 *   MKT = (ΔH/R) / −ln( Σ wᵢ·e^(−ΔH/(R·Tᵢ)) / Σ wᵢ )
 * Reduces to the classic equal-interval formula when sampling is constant.
 */
export function mkt(readings: Reading[], deltaHkJ = DEFAULT_HEAT_OF_ACTIVATION_KJ): number {
  if (readings.length === 0) return NaN;
  if (readings.length === 1) return readings[0].tempC;
  const dH = deltaHkJ * 1000;
  const w = durationWeights(readings);
  let weighted = 0;
  let total = 0;
  readings.forEach((r, i) => {
    weighted += w[i] * Math.exp(-dH / (R * (r.tempC + KELVIN)));
    total += w[i];
  });
  if (total === 0) return NaN;
  return dH / R / -Math.log(weighted / total) - KELVIN;
}

function segments(rs: Reading[], minC: number, maxC: number) {
  const segs: ExcursionSegment[] = [];
  let above = 0;
  let below = 0;
  let cur: ExcursionSegment | null = null;
  const flush = (endIdx: number) => {
    if (!cur) return;
    cur.end = rs[endIdx].at;
    cur.hours = (ms(cur.end) - ms(cur.start)) / 3_600_000;
    if (cur.direction === "high") above += cur.hours;
    else below += cur.hours;
    segs.push(cur);
    cur = null;
  };
  rs.forEach((r, i) => {
    const dir: "high" | "low" | "" = r.tempC > maxC ? "high" : r.tempC < minC ? "low" : "";
    if (dir === "") {
      flush(i);
      return;
    }
    if (cur && cur.direction !== dir) flush(i);
    if (!cur) cur = { direction: dir, start: r.at, end: r.at, hours: 0, peakC: r.tempC };
    if ((dir === "high" && r.tempC > cur.peakC) || (dir === "low" && r.tempC < cur.peakC)) cur.peakC = r.tempC;
  });
  if (cur) flush(rs.length - 1);
  return { segs, above, below };
}

/**
 * Rules-based FIRST-PASS recommendation, never a final decision. Order matters:
 * hard stops, then the USP <1079.2> repeat-offender gate (which explicitly overrides
 * an otherwise-passing MKT), then budget, then MKT, then the benign case.
 */
function provisional(a: Omit<Assessment, "disposition" | "dispositionRationale">): [Disposition, string] {
  if (a.hardLimitHit)
    return ["REJECT", "Temperature exceeded the stability-supported maximum; MKT is not applicable. Recommend quarantine and destruction."];
  if (a.repeatOffender)
    return ["ESCALATE", `This lane/product has ${a.priorExcursionCount} prior excursion(s). Per USP <1079.2> MKT may not be used to justify release of a system not in a state of control. Recommend deviation + CAPA.`];
  if (a.budgetExceeded)
    return ["REJECT/INVESTIGATE", "Cumulative time-out-of-storage exceeds the product's stability budget. Recommend quarantine pending full stability review."];
  if (a.mktExceeded)
    return ["INVESTIGATE", "MKT over the assessed window exceeds the product's limit. Recommend quarantine pending review."];
  return ["RELEASE (provisional)", "Within stability budget and MKT limit. Still requires QA review and e-signature before disposition."];
}

export function assess(readingsIn: Reading[], budget: StabilityBudget, priorExcursionCount: number): Assessment {
  const deltaH = budget.heatOfActivationKJ || DEFAULT_HEAT_OF_ACTIVATION_KJ;
  const rs = [...readingsIn].sort((x, y) => ms(x.at) - ms(y.at));
  const base = {
    readingCount: rs.length,
    windowHours: 0,
    minC: NaN,
    maxC: NaN,
    meanC: NaN,
    mktC: NaN,
    heatOfActivationKJ: deltaH,
    labelMinC: budget.labelMinC,
    labelMaxC: budget.labelMaxC,
    hoursAboveMax: 0,
    hoursBelowMin: 0,
    torOutHours: 0,
    segments: [] as ExcursionSegment[],
    torBudgetHours: budget.torBudgetHours,
    torPriorHours: budget.torPriorHours,
    torRemainingHours: budget.torBudgetHours - budget.torPriorHours,
    budgetConsumedPct: 0,
    budgetExceeded: false,
    mktLimitC: budget.mktLimitC,
    mktExceeded: false,
    hardLimitC: budget.excursionMaxC,
    hardLimitHit: false,
    priorExcursionCount,
    repeatOffender: priorExcursionCount > 0,
  };
  if (rs.length === 0) {
    const [disposition, dispositionRationale] = provisional(base);
    return { ...base, disposition, dispositionRationale };
  }

  base.mktC = mkt(rs, deltaH);
  base.windowHours = (ms(rs[rs.length - 1].at) - ms(rs[0].at)) / 3_600_000;

  const w = durationWeights(rs);
  base.minC = rs[0].tempC;
  base.maxC = rs[0].tempC;
  let weightedTemp = 0;
  let total = 0;
  rs.forEach((r, i) => {
    base.minC = Math.min(base.minC, r.tempC);
    base.maxC = Math.max(base.maxC, r.tempC);
    weightedTemp += w[i] * r.tempC;
    total += w[i];
    if (r.tempC > budget.excursionMaxC) base.hardLimitHit = true;
  });
  if (total > 0) base.meanC = weightedTemp / total;

  const { segs, above, below } = segments(rs, budget.labelMinC, budget.labelMaxC);
  base.segments = segs;
  base.hoursAboveMax = above;
  base.hoursBelowMin = below;
  base.torOutHours = above + below;

  const consumed = budget.torPriorHours + base.torOutHours;
  base.torRemainingHours = budget.torBudgetHours - consumed;
  if (budget.torBudgetHours > 0) base.budgetConsumedPct = (100 * consumed) / budget.torBudgetHours;
  base.budgetExceeded = consumed > budget.torBudgetHours;
  base.mktExceeded = budget.mktLimitC !== 0 && base.mktC > budget.mktLimitC;

  const [disposition, dispositionRationale] = provisional(base);
  return { ...base, disposition, dispositionRationale };
}
