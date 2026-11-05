import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { validatePoints } from "@/lib/domain/entry/points";
import { entryDecision, deadlinePassed, todayIst } from "@/lib/domain/cycle/cycle";
import { enterPcPoint } from "@/lib/actions/enterPoint";
import { loadPcQuestions } from "@/lib/actions/groupQueue";
import { currentMonth } from "@/lib/actions/teamQueue";

export const instant = false;
const enc = encodeURIComponent;

export default async function PcReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const p = await getPrincipal();
  if (!p || !p.cabiesId) return <Denied />;

  const { id } = await params;
  const sp = await searchParams;
  const repo = await getRepo();
  const report = (await repo.readUsers()).find((u) => u.cabiesId === id);
  if (!report || !p.pcUnitIds.has(report.departmentId)) {
    return <Denied reason="This person is not in a department you cover." />;
  }

  const month = await currentMonth(repo);
  const questions = await loadPcQuestions(repo, report, month);

  async function saveAll(formData: FormData) {
    "use server";
    const back = `/queue/pc/${id}`;
    const principal = await getPrincipal();
    if (!principal || !principal.cabiesId) {
      redirect(`${back}?error=${enc("Your session has expired. Sign in again.")}`);
    }

    const repo2 = await getRepo();
    const r2 = (await repo2.readUsers()).find((u) => u.cabiesId === id);
    if (!r2 || !principal.pcUnitIds.has(r2.departmentId)) {
      redirect(`/queue/pc?error=${enc("You can only enter scores for departments you cover.")}`);
    }

    const cycles = await repo2.readCycles();
    const openCyc = cycles.find((c) => c.status === "OPEN") ?? null;
    const today = todayIst();
    const decision = entryDecision(openCyc, today);
    if (!decision.allowed) {
      redirect(`${back}?error=${enc(decision.reason ?? "Entry is closed.")}`);
    }
    const freshMonth = openCyc!.month;
    const passedDeadline = deadlinePassed(openCyc, today);

    const qs = await loadPcQuestions(repo2, r2!, freshMonth);
    const errors: string[] = [];
    const plan: { index: number; points: number }[] = [];

    qs.forEach((q, i) => {
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
      redirect(`${back}?error=${enc("Nothing was saved. Fix these first: " + errors.join(" | "))}`);
    }
    if (plan.length === 0) {
      redirect(`${back}?error=${enc("Enter at least one score before saving.")}`);
    }

    for (const { index, points } of plan) {
      const q = qs[index];
      await enterPcPoint(
        principal,
        {
          appraisalMonth: freshMonth,
          instance: q.component,
          component: q.component,
          project: "",
          section: q.section,
          question: q.question,
          points,
          maxPoints: q.maxPoints as number,
          minPoints: q.minPoints as number,
          item: { status: "NOT_ENTERED", deadlinePassed: passedDeadline },
          cycle: { status: openCyc!.status as "OPEN" },
          appraiseeId: r2!.cabiesId,
          appraiseeName: r2!.name,
          appraiseeDepartmentId: r2!.departmentId,
        },
        repo2,
        new Date().toISOString(),
      );
    }

    revalidatePath(back);
    redirect(`${back}?saved=${plan.length}`);
  }

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{report.name} — {month}</h1>
          <p style={{ color: "#646767", fontSize: 13 }}>{report.designation} · PC-rated scores you enter</p>
        </div>
        <Link href="/queue/pc" style={{ color: "#646767" }}>← PC queue</Link>
      </div>

      {sp.error && <div style={{ ...banner, background: "#fdecea", color: "#8a1c1c" }}>{sp.error}</div>}
      {sp.saved && (
        <div style={{ ...banner, background: "#e8f5e9", color: "#2e7d32" }}>
          Saved {sp.saved} score{sp.saved === "1" ? "" : "s"}.
        </div>
      )}

      {questions.length === 0 ? (
        <p style={{ color: "#646767" }}>No PC-rated questions for this person this month.</p>
      ) : (
        <form action={saveAll}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions.map((q, i) => (
              <div key={`${i}-${q.question}`} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#646767" }}>{q.section} · {q.component}</div>
                    <div style={{ marginTop: 4 }}>{q.question}</div>
                    <div style={{ fontSize: 12, color: "#8a6d3b", marginTop: 4 }}>
                      max {q.maxPoints}, min {q.minPoints}
                    </div>
                  </div>
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
                </div>
              </div>
            ))}
          </div>
          <div style={{ position: "sticky", bottom: 0, background: "#FAF8F3", padding: "16px 0", textAlign: "right" }}>
            <button type="submit" style={saveBtn}>Save all scores</button>
          </div>
        </form>
      )}
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