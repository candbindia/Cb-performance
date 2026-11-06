import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { openCycleForHr } from "@/lib/actions/cycleOpen";

export const instant = false;
const enc = encodeURIComponent;

async function Result({ searchParams }: { searchParams: Promise<{ result?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.error && <div style={{ ...banner, background: "#fdecea", color: "#8a1c1c" }}>{sp.error}</div>}
      {sp.result && <div style={{ ...banner, background: "#e8f5e9", color: "#2e7d32" }}>{sp.result}</div>}
    </>
  );
}

export default function OpenCyclePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Open a cycle</h1>
      <p style={{ color: "#646767", fontSize: 13, marginBottom: 20 }}>
        Sets the month's status to OPEN and its deadlines. Optionally writes GROUP default
        scores (max points, except for each rater's own items) in the same step.
      </p>

      <form action={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}>
          <label>
            Month (YYYY-MM)
            <input name="month" required pattern="\d{4}-\d{2}" style={input} placeholder="2026-09" />
          </label>
          <label>
            Entry deadline
            <input name="entryDeadline" type="date" required style={input} />
          </label>
          <label>
            Approval deadline
            <input name="approvalDeadline" type="date" required style={input} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input name="applyDefaults" type="checkbox" value="yes" defaultChecked />
            Apply GROUP default scores automatically (recommended)
          </label>
          <button type="submit" style={saveBtn}>Open cycle</button>
        </div>
      </form>

      <Suspense>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function submit(formData: FormData) {
  "use server";
  const principal = await getPrincipal();
  if (!principal) redirect("/login");

  const month = String(formData.get("month") ?? "");
  const entryDeadline = String(formData.get("entryDeadline") ?? "");
  const approvalDeadline = String(formData.get("approvalDeadline") ?? "");
  const applyDefaults = formData.get("applyDefaults") === "yes";

  const repo = await getRepo();

  try {
    const result = await openCycleForHr(
      principal,
      repo,
      { month, entryDeadline, approvalDeadline, applyDefaults },
      new Date().toISOString(),
    );

    let msg = `Cycle ${result.month} is now OPEN.`;
    if (applyDefaults) {
      if (result.defaults) {
        msg += ` ${result.defaults.defaulted} GROUP defaults written, ${result.defaults.skippedSelf} self-items skipped.`;
      } else if (result.defaultsError) {
        msg += ` Defaults were not applied: ${result.defaultsError}`;
      }
    }
    redirect(`/hr/open-cycle?result=${enc(msg)}`);
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(`/hr/open-cycle?error=${enc(e.message)}`);
  }
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const input: React.CSSProperties = { display: "block", width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", marginTop: 4 };
const saveBtn: React.CSSProperties = { background: "#F2AC3C", color: "#111", border: "none", padding: "10px 20px", borderRadius: 6, fontWeight: 600, cursor: "pointer", width: "fit-content" };
const banner: React.CSSProperties = { padding: "10px 14px", borderRadius: 6, marginTop: 16, fontSize: 14 };