// My Appraisal — one form, one "Save all scores" button. Every entered score is checked first;
// if any is invalid, nothing is written. Blank boxes are skipped (not entered yet).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { deriveAllItemStates } from "@/lib/domain/entry/status";
import { resolveMyQuestions } from "@/lib/domain/entry/myQuestions";
import { validatePoints } from "@/lib/domain/entry/points";
import { openCycle, entryDecision, deadlinePassed, todayIst } from "@/lib/domain/cycle/cycle";
import { enterSelfPoint } from "@/lib/actions/enterPoint";
import { deptName,supportSubTeam } from "@/lib/actions/teamQueue";



export const instant = false;
const enc = encodeURIComponent;

type Principal = NonNullable<Awaited<ReturnType<typeof getPrincipal>>>;

// Used by both the page and the save action, so the save re-reads everything on the server.
async function loadMine(p: Principal) {
  
  const repo = await getRepo();
  const cycle = openCycle(await repo.readCycles());
  const month = cycle?.month ?? "";
  const [users, params, events] = await Promise.all([
    repo.readUsers(),
    repo.readKpiParams(),
    month ? repo.readItemEvents(p.cabiesId, month) : Promise.resolve([]),
  ]);
  const me = users.find((u) => u.cabiesId === p.cabiesId) ?? null;
  if (!me || !cycle) return { me, cycle, month, questions: [] as ReturnType<typeof resolveMyQuestions> };
  const states = deriveAllItemStates(events);
  const subTeam = me.departmentId === "SS" ? supportSubTeam(me.teamId) : undefined;
  const questions = resolveMyQuestions(params, deptName(me.departmentId), me.designation, month, states, subTeam);
  return { me, cycle, month, questions };
}

export default async function MyAppraisal({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const p = await getPrincipal();
  if (!p || !p.cabiesId) return <Denied />;

  const { me, cycle, month, questions } = await loadMine(p);
  if (!me) return <Denied reason="Your profile was not found in the Users sheet." />;
  if (!cycle) return <Denied reason="No appraisal cycle is open right now." />;
  const sp = await searchParams;

  async function saveAll(formData: FormData) {
    "use server";
    const principal = await getPrincipal();
    if (!principal || !principal.cabiesId) {
      redirect(`/me?error=${enc("Your session has expired. Sign in again.")}`);
    }

    const { questions: fresh, cycle: c, month: m } = await loadMine(principal);
    const today = todayIst();
    const decision = entryDecision(c, today);
    if (!decision.allowed || !c) {
      redirect(`/me?error=${enc(decision.reason ?? "Entry is closed.")}`);
    }

    const errors: string[] = [];
    const plan: { index: number; points: number }[] = [];

    fresh.forEach((q, i) => {
      if (!q.iAmTheRater) return;
      const raw = String(formData.get(`points-${i}`) ?? "").trim();
      if (raw === "") return;
      const points = Number(raw);
      const problem = Number.isFinite(points)
        ? validatePoints({ points, maxPoints: q.maxPoints as number, minPoints: q.minPoints as number })
        : "not a number";
      if (problem) errors.push(`${q.question}: ${problem}`);
      else plan.push({ index: i, points });
    });

    if (errors.length) {
      redirect(`/me?error=${enc("Nothing was saved. Fix these first: " + errors.join(" | "))}`);
    }
    if (plan.length === 0) {
      redirect(`/me?error=${enc("Enter at least one score before saving.")}`);
    }

    const repo = await getRepo();
    for (const { index, points } of plan) {
      const q = fresh[index];
      await enterSelfPoint(
        principal,
        {
          appraisalMonth: m, instance: "VP", component: "VP", project: "",
          section: q.section, question: q.question,
          points, maxPoints: q.maxPoints as number, minPoints: q.minPoints as number,
          item: { status: "NOT_ENTERED", deadlinePassed: deadlinePassed(c, today) },
          cycle: { status: c.status as "OPEN" },
        },
        repo,
        new Date().toISOString(),
      );
    }

    revalidatePath("/me");
    redirect(`/me?saved=${plan.length}`);
  }

  const selfQs = questions.filter((q) => q.iAmTheRater);
  const enteredCount = selfQs.filter((q) => q.state.status !== "NOT_ENTERED").length;

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>My Appraisal — {month}</h1>
          <p style={{ color: "#646767", fontSize: 13 }}>
            {me.name} · {me.designation} · {deptName(me.departmentId)} · entry closes {cycle.entryDeadline}
          </p>
        </div>
        <Link href="/" style={{ color: "#646767" }}>← Home</Link>
      </div>

      {sp.error && <div style={{ ...banner, background: "#fdecea", color: "#8a1c1c" }}>{sp.error}</div>}
      {sp.saved && (
        <div style={{ ...banner, background: "#e8f5e9", color: "#2e7d32" }}>
          Saved {sp.saved} score{sp.saved === "1" ? "" : "s"}.
        </div>
      )}

      <p style={{ color: "#646767", marginBottom: 16 }}>
        Self questions entered: {enteredCount} / {selfQs.length}
      </p>

      {questions.length === 0 && (
        <p style={{ color: "#646767" }}>No KPI parameters found for your role yet. Ask HR to confirm the setup.</p>
      )}

      <form action={saveAll}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map((q, i) => (
            <div key={`${i}-${q.question}`} style={card}>
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
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <input
                      name={`points-${i}`}
                      type="number"
                      step="0.01"
                      defaultValue={q.state.value ?? ""}
                      key={`${i}-${q.question}-${q.state.value ?? ""}`}
                      style={input}
                    />
                    {q.state.status !== "NOT_ENTERED" && (
                      <span style={{ fontSize: 12, color: "#2e7d32" }}>Saved</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#646767", minWidth: 90, textAlign: "right" }}>
                    {q.state.value ?? "—"} <span style={{ color: "#aaa" }}>({q.state.status})</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {selfQs.length > 0 && (
          <div style={{ position: "sticky", bottom: 0, background: "#FAF8F3", padding: "16px 0", textAlign: "right" }}>
            <button type="submit" style={saveBtn}>Save all scores</button>
          </div>
        )}
      </form>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 8, padding: "14px 16px" };
const input: React.CSSProperties = { width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" };
const saveBtn: React.CSSProperties = { background: "#F2AC3C", color: "#111", border: "none", padding: "10px 20px", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
const banner: React.CSSProperties = { padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 14 };

function Denied({ reason }: { reason?: string }) {
  return <main style={wrap}><p>Not authorised. {reason}</p><Link href="/">← Home</Link></main>;
}