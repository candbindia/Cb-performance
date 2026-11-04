// My Appraisal — the real entry screen. Self-rated questions get an editable box and a
// Save button that actually writes to the Sheet (ItemEvents + the readable KPI_Points tab).
// Non-Self questions (RM/Group/PC) are shown read-only for now; their own entry queues are
// separate screens, not built yet.
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { deriveAllItemStates } from "@/lib/domain/entry/status";
import { resolveMyQuestions } from "@/lib/domain/entry/myQuestions";
import { enterSelfPoint } from "@/lib/actions/enterPoint";
import Link from "next/link";

export const instant = false;

const MONTH = "2026-09"; // the open appraisal month — will come from Cycles once that exists

export default async function MyAppraisal() {
  const p = await getPrincipal();
  if (!p || !p.cabiesId) return <Denied />;

  const repo = await getRepo();
  const [users, params, events] = await Promise.all([
    repo.readUsers(),
    repo.readKpiParams(),
    repo.readItemEvents(p.cabiesId, MONTH),
  ]);

  const me = users.find((u) => u.cabiesId === p.cabiesId);
  if (!me) return <Denied reason="Your profile was not found in the Users sheet." />;

  const states = deriveAllItemStates(events);
  const questions = resolveMyQuestions(params, me.departmentId === "SS" ? "Support Staff" : deptName(me.departmentId), me.designation, MONTH, states);

  async function save(formData: FormData) {
    "use server";
    const principal = await getPrincipal();
    if (!principal || !principal.cabiesId) return;
    const question = String(formData.get("question"));
    const points = Number(formData.get("points"));
    const section = String(formData.get("section"));
    const maxPoints = Number(formData.get("maxPoints"));
    const minPoints = Number(formData.get("minPoints"));

    await enterSelfPoint(
      principal,
      {
        appraisalMonth: MONTH, instance: "VP", component: "VP", project: "", section, question,
        points, maxPoints, minPoints,
        item: { status: "NOT_ENTERED", deadlinePassed: false },
        cycle: { status: "OPEN" },
      },
      await getRepo(),
      new Date().toISOString(),
    );
  }

  const selfCount = questions.filter((q) => q.iAmTheRater).length;
  const enteredCount = questions.filter((q) => q.iAmTheRater && q.state.status !== "NOT_ENTERED").length;

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>My Appraisal — {MONTH}</h1>
          <p style={{ color: "#646767", fontSize: 13 }}>{me.name} · {me.designation} · {deptName(me.departmentId)}</p>
        </div>
        <Link href="/" style={{ color: "#646767" }}>← Home</Link>
      </div>

      <p style={{ color: "#646767", marginBottom: 16 }}>
        Self questions entered: {enteredCount} / {selfCount}
      </p>

      {questions.length === 0 && (
        <p style={{ color: "#646767" }}>No KPI parameters found for your role yet. Ask HR to confirm the setup.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {questions.map((q) => (
          <div key={q.question} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#646767" }}>{q.section} · {q.component}</div>
                <div style={{ marginTop: 4 }}>{q.question}</div>
                <div style={{ fontSize: 12, color: "#8a6d3b", marginTop: 4 }}>
                  Rated by {q.raterKind === "SELF" ? "you" : q.raterKind === "GROUP" ? q.raterGroup : q.raterKind}
                  {" · "}max {q.maxPoints}, min {q.minPoints}
                </div>
              </div>

              {q.iAmTheRater ? (
                <form action={save} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="hidden" name="question" value={q.question} />
                  <input type="hidden" name="section" value={q.section} />
                  <input type="hidden" name="maxPoints" value={q.maxPoints ?? ""} />
                  <input type="hidden" name="minPoints" value={q.minPoints ?? ""} />
                  <input
                    name="points"
                    type="number"
                    step="0.01"
                    defaultValue={q.state.value ?? ""}
                    style={input}
                  />
                  <button type="submit" style={saveBtn}>Save</button>
                </form>
              ) : (
                <div style={{ fontSize: 13, color: "#646767", minWidth: 90, textAlign: "right" }}>
                  {q.state.value ?? "—"} <span style={{ color: "#aaa" }}>({q.state.status})</span>
                </div>
              )}
            </div>
            {q.iAmTheRater && q.state.status !== "NOT_ENTERED" && (
              <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 6 }}>Saved — {q.state.status}</div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function deptName(id: string) {
  const names: Record<string, string> = {
    MC: "Management Consulting", CF: "Corporate Finance", IA: "Internal Audit", TX: "Taxation", SS: "Support Staff",
  };
  return names[id] ?? id;
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 8, padding: "14px 16px" };
const input: React.CSSProperties = { width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" };
const saveBtn: React.CSSProperties = { background: "#F2AC3C", color: "#111", border: "none", padding: "6px 14px", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
function Denied({ reason }: { reason?: string }) {
  return <main style={wrap}><p>Not authorised. {reason}</p><Link href="/">← Home</Link></main>;
}
