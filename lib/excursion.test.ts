import { describe, expect, it } from "vitest";
import { DEFAULT_HEAT_OF_ACTIVATION_KJ, assess, mkt, type Reading, type StabilityBudget } from "./excursion";

const base = Date.UTC(2026, 6, 1);
const at = (h: number) => new Date(base + h * 3_600_000).toISOString();
const readings = (temps: number[], hours: number[]): Reading[] => temps.map((tempC, i) => ({ at: at(hours[i]), tempC }));
const budget: StabilityBudget = { labelMinC: 2, labelMaxC: 8, excursionMaxC: 30, torBudgetHours: 72, torPriorHours: 0, mktLimitC: 25 };

describe("MKT", () => {
  it("returns the exact temperature for a constant trace (guards Kelvin/unit bugs)", () => {
    for (const t of [-20, 2, 5, 8, 25, 40]) {
      expect(mkt(readings([t, t, t, t], [0, 1, 2, 3]))).toBeCloseTo(t, 6);
    }
  });
  it("is never below the arithmetic mean (Jensen on the Arrhenius weighting)", () => {
    const temps = [2, 4, 6, 20, 8, 5];
    const mean = temps.reduce((a, b) => a + b) / temps.length;
    expect(mkt(readings(temps, [0, 1, 2, 3, 4, 5]))).toBeGreaterThanOrEqual(mean);
  });
  it("pins the reference value for two equal intervals at 20 and 40 °C", () => {
    const got = mkt(readings([20, 40], [0, 1]), DEFAULT_HEAT_OF_ACTIVATION_KJ);
    expect(Math.abs(got - 34.358)).toBeLessThan(0.05);
    expect(got).toBeGreaterThan(30);
    expect(got).toBeLessThan(40);
  });
});

describe("assess", () => {
  it("credits a benign high excursion within budget", () => {
    const a = assess(readings([5, 5, 15, 15, 5], [0, 4, 4, 10, 10]), budget, 0);
    expect(a.hoursAboveMax).toBeGreaterThan(0);
    expect(a.hoursBelowMin).toBe(0);
    expect(a.segments).toHaveLength(1);
    expect(a.segments[0].direction).toBe("high");
    expect(a.segments[0].peakC).toBe(15);
    expect(a.budgetExceeded).toBe(false);
    expect(a.hardLimitHit).toBe(false);
    expect(a.disposition).toBe("RELEASE (provisional)");
  });
  it("USP <1079.2>: a prior excursion flips passing numbers to ESCALATE", () => {
    const a = assess(readings([5, 5, 12, 5], [0, 2, 2, 4]), budget, 2);
    expect(a.repeatOffender).toBe(true);
    expect(a.disposition).toBe("ESCALATE");
  });
  it("flags INVESTIGATE when the MKT limit is exceeded but budget holds", () => {
    const a = assess(readings([5, 5, 15, 15, 5], [0, 4, 4, 10, 10]), { ...budget, mktLimitC: 8 }, 0);
    expect(a.mktExceeded).toBe(true);
    expect(a.disposition).toBe("INVESTIGATE");
  });
  it("rejects on the hard ceiling regardless of budget", () => {
    const a = assess(readings([5, 35, 5], [0, 1, 2]), budget, 0);
    expect(a.hardLimitHit).toBe(true);
    expect(a.disposition).toBe("REJECT");
  });
  it("the same trace gets a different answer under a different stability profile", () => {
    const trace = readings([5, 5, 14, 14, 14, 5], [0, 4, 4, 20, 34, 34]); // 30 h out of window
    const v2 = assess(trace, { ...budget, torBudgetHours: 24 }, 0);
    const v3 = assess(trace, { ...budget, torBudgetHours: 48 }, 0);
    expect(v2.disposition).toBe("REJECT/INVESTIGATE");
    expect(v3.disposition).toBe("RELEASE (provisional)");
  });
});
