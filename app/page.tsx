"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ShipmentRow = { shipmentId: string; status: string; alarmReason?: string; departedAt: string; product: string; productCode: string; lane: string; packout?: string };

type AssessOutput = {
  trace?: Array<{ at: string; tempC: number }>;
  shipment?: { shipmentId: string; lane: string; packout?: string | null; lotNumber?: string };
  product?: { code: string; name: string };
  governingProfile?: { version: string; status: string; effectiveDate?: string; sourceDocument?: { docId: string; version: string } };
  assessment?: { disposition: string; dispositionRationale: string; windowHours: number; minC: number; maxC: number; meanC: number; mktC: number; mktLimitC: number; mktExceeded: boolean; torOutHours: number; torBudgetHours: number; torRemainingHours: number; budgetConsumedPct: number; budgetExceeded: boolean; hardLimitC: number; hardLimitHit: boolean; labelMinC: number; labelMaxC: number; priorExcursionCount: number; repeatOffender: boolean };
  underSupersededProfiles?: Array<{ version: string; disposition: string; torBudgetHours: number }>;
};

const f = (n: number | undefined, d = 1) => (n !== undefined && Number.isFinite(n) ? n.toFixed(d) : "—");

/* The logger trace, with the label band shaded and out-of-range runs drawn in heat colour. */
function TraceChart({ o }: { o: AssessOutput }) {
  const a = o.assessment;
  const pts = o.trace ?? [];
  if (!a || pts.length < 2) return null;
  const W = 900, H = 170, L = 38, R = 14, T = 14, B = 26;
  const t0 = new Date(pts[0].at).getTime(), t1 = new Date(pts[pts.length - 1].at).getTime();
  // Scale to the label band and the trace; the ceiling is drawn only if it falls inside that range.
  const lo = Math.min(a.labelMinC - 2, a.minC - 1), hi = Math.max(a.labelMaxC + 6, a.maxC + 2);
  const showCeiling = a.hardLimitC <= hi;
  const x = (t: string) => L + ((new Date(t).getTime() - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (c: number) => T + (1 - (c - lo) / (hi - lo)) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.tempC).toFixed(1)}`).join(" ");
  // Out-of-range runs as separate overlays.
  const hot: string[] = [];
  let run: string[] = [];
  pts.forEach((p, i) => {
    const out = p.tempC > a.labelMaxC || p.tempC < a.labelMinC;
    if (out) run.push(`${run.length ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.tempC).toFixed(1)}`);
    if ((!out || i === pts.length - 1) && run.length > 1) { hot.push(run.join(" ")); run = []; }
    else if (!out) run = [];
  });
  const hours = (t1 - t0) / 3.6e6;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => ({ x: L + k * (W - L - R), label: `${Math.round(k * hours)} h` }));
  const yTicks = [a.labelMinC, a.labelMaxC, ...(showCeiling ? [a.hardLimitC] : [])].filter((v, i, arr) => arr.indexOf(v) === i);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Logger trace, ${f(hours, 0)} hours, ${f(a.torOutHours)} hours out of the ${a.labelMinC} to ${a.labelMaxC} degree range`}>
      <rect className="band" x={L} width={W - L - R} y={y(a.labelMaxC)} height={y(a.labelMinC) - y(a.labelMaxC)} />
      {yTicks.map((v) => (
        <g key={v}>
          <line className={v === a.hardLimitC ? "ceiling" : "gl"} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="axis" x={L - 6} y={y(v) + 3.5} textAnchor="end">{v}°</text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t.label} className="axis" x={t.x} y={H - 8} textAnchor={t.x === L ? "start" : t.x >= W - R - 1 ? "end" : "middle"}>{t.label}</text>
      ))}
      {!showCeiling && <text className="axis" x={W - R} y={T + 9} textAnchor="end">ceiling {a.hardLimitC}° above chart</text>}
      <path className="line" d={path} vectorEffect="non-scaling-stroke" />
      {hot.map((d, i) => <path key={i} className="hot" d={d} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

function AssessmentCard({ output }: { output: unknown }) {
  const o = output as AssessOutput;
  const a = o?.assessment;
  if (!a) return null;
  const cls = a.disposition.split(/[ /(]/)[0];
  return (
    <section className="assess">
      <div className="assess-head">
        <div className="who">{o.shipment?.shipmentId}<small>{o.product?.code} {o.product?.name} · lot {o.shipment?.lotNumber} · {o.shipment?.lane}</small></div>
        <span className={`verdict ${cls}`}>{a.disposition}</span>
      </div>
      <TraceChart o={o} />
      <div className="readout">
        <div><div className="k">Monitored window</div><div className="v">{f(a.windowHours)} <small>h</small></div></div>
        <div><div className="k">Out of {a.labelMinC}–{a.labelMaxC} °C</div><div className={`v ${a.budgetExceeded ? "bad" : a.torOutHours > 0 ? "warm" : ""}`}>{f(a.torOutHours)} <small>of {a.torBudgetHours} h ({f(a.budgetConsumedPct, 0)} %)</small></div></div>
        <div><div className="k">Peak vs ceiling</div><div className={`v ${a.hardLimitHit ? "bad" : ""}`}>{f(a.maxC)} <small>/ {a.hardLimitC} °C</small></div></div>
        <div><div className="k">MKT vs limit</div><div className={`v ${a.mktExceeded ? "bad" : ""}`}>{f(a.mktC, 2)} <small>/ {a.mktLimitC} °C</small></div></div>
        <div><div className="k">Mean</div><div className="v">{f(a.meanC)} <small>°C</small></div></div>
        <div><div className="k">Prior deviations, 12 mo</div><div className={`v ${a.repeatOffender ? "bad" : ""}`}>{a.priorExcursionCount}</div></div>
      </div>
      <div className="assess-foot">
        Assessed against <b>{o.governingProfile?.sourceDocument?.docId} {o.governingProfile?.version}</b> ({o.governingProfile?.status}{o.governingProfile?.effectiveDate ? ` since ${o.governingProfile.effectiveDate}` : ""}).
        {o.underSupersededProfiles?.length ? <> Under superseded {o.underSupersededProfiles.map((p) => `${p.version} (${p.torBudgetHours} h budget) this would be ${p.disposition}`).join("; ")}.</> : null}
        {" "}{a.dispositionRationale}
      </div>
    </section>
  );
}

function ToolTrace({ name, input, output, state }: { name: string; input: unknown; output?: unknown; state: string }) {
  const short = (v: unknown) => { const s = JSON.stringify(v, null, 2) ?? ""; return s.length > 6000 ? s.slice(0, 6000) + "\n…" : s; };
  const inp = input as { query?: string; docId?: string; paths?: string[] } | undefined;
  const hint = inp?.query ?? inp?.docId ?? inp?.paths?.join(", ") ?? "";
  const src = name.startsWith("sanity_") ? "Sanity Context" : name.startsWith("kb_") ? "Knowledge Base" : "Dataset";
  return (
    <details className="trace">
      <summary><b>{src}</b> {name.replace(/^(sanity_|kb_)/, "")} <span className="q">{hint}</span>{state !== "output-available" && <span>{state}</span>}</summary>
      <pre>{short(input)}</pre>
      {output !== undefined && <pre>{short(output)}</pre>}
    </details>
  );
}

const SECTION_CLASS: Record<string, string> = {
  "provisional disposition": "disposition",
  "contradictions found": "contradictions",
  "draft deviation summary": "summary",
};

/* Split the memo on its level-2 headings and lay each section out with the title in the margin. */
function Memo({ text }: { text: string }) {
  const sections = useMemo(() => {
    const parts = text.split(/^## +/m).filter((s) => s.trim());
    return parts.map((p) => {
      const nl = p.indexOf("\n");
      const title = nl === -1 ? p.trim() : p.slice(0, nl).trim();
      let body = nl === -1 ? "" : p.slice(nl + 1);
      // Contradiction items: put each labelled part on its own line.
      if (title.toLowerCase() === "contradictions found") body = body.replace(/\s+(\*\*(?:Claim B|Governs|If the losing claim had governed)[^*]*\*\*)/g, "  \n$1");
      return { title, body };
    });
  }, [text]);
  if (sections.length < 2) return <article className="memo"><div className="sec"><h2></h2><div className="body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div></div></article>;
  return (
    <article className="memo">
      {sections.map((s, i) => (
        <div key={i} className={`sec ${SECTION_CLASS[s.title.toLowerCase()] ?? ""}`}>
          <h2>{s.title}</h2>
          <div className="body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown></div>
        </div>
      ))}
    </article>
  );
}

export default function Page() {
  const { messages, sendMessage, status } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  const [input, setInput] = useState("");
  const [ships, setShips] = useState<ShipmentRow[]>([]);
  const [source, setSource] = useState<string>("");
  useEffect(() => {
    fetch("/api/shipments").then((r) => r.json()).then((d) => { setShips(d.shipments ?? []); setSource(d.source ?? ""); }).catch(() => {});
  }, []);
  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => { if (!busy && text.trim()) { sendMessage({ text }); setInput(""); } };

  return (
    <div className="app">
      <aside className="queue">
        <div className="queue-head">
          <h1>Disposition Desk</h1>
          <p>Ilmenau Therapeutics, Quality Assurance</p>
          <div className={`source ${source === "sanity" ? "" : "local"}`}><i />{source === "sanity" ? "Reading the live Sanity dataset" : source ? "Reading the bundled dataset" : "Connecting"}</div>
        </div>
        <div className="queue-list">
          <div className="queue-label">Shipments on hold with an open alarm</div>
          {ships.map((s) => (
            <button key={s.shipmentId} className="case" onClick={() => ask(`Assess shipment ${s.shipmentId} and draft the disposition memo.`)} disabled={busy}>
              <div className="id">{s.shipmentId}</div>
              <div className="what">{s.productCode} {s.product}, {s.lane}{s.packout ? `, ${s.packout}` : ""}</div>
              {s.alarmReason && <div className="alarm">{s.alarmReason}</div>}
            </button>
          ))}
        </div>
        <div className="queue-foot">Numbers are computed, not generated. Governing documents come from the content model. A Qualified Person signs.</div>
      </aside>
      <main className="desk">
        <div className="thread">
          <div className="column">
            {messages.length === 0 && (
              <div className="empty">
                <h2>Pick a shipment to assess.</h2>
                <p>The desk computes the excursion numbers, walks the quality content model to find which stability profile, procedure, qualification report and lane assessment actually govern, and shows where those documents contradict each other before drafting the memo.</p>
                <p>Try SHP-26-0911 for a version conflict, or SHP-26-0874 for a lane that keeps failing.</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <div className="ask"><span>{m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}</span></div>
                ) : (
                  m.parts.map((part, i) => {
                    if (part.type === "text") return <Memo key={i} text={part.text} />;
                    if (part.type === "dynamic-tool") return <ToolTrace key={i} name={part.toolName} input={part.input} output={"output" in part ? part.output : undefined} state={part.state} />;
                    if (part.type.startsWith("tool-")) {
                      const p = part as unknown as { type: string; input: unknown; output?: unknown; state: string };
                      const name = p.type.slice(5);
                      if (name === "assess_excursion" && p.state === "output-available") return <AssessmentCard key={i} output={p.output} />;
                      return <ToolTrace key={i} name={name} input={p.input} output={p.output} state={p.state} />;
                    }
                    return null;
                  })
                )}
              </div>
            ))}
            {busy && <div className="working">Working through the content…</div>}
          </div>
        </div>
        <div className="compose">
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a shipment, a lane, or which document governs" disabled={busy} aria-label="Ask the desk" />
            <button type="submit" disabled={busy || !input.trim()}>Ask</button>
          </form>
        </div>
      </main>
    </div>
  );
}
