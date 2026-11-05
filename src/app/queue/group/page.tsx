import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { loadGroupReports } from "@/lib/actions/groupQueue";
import { currentMonth } from "@/lib/actions/teamQueue";

export const instant = false;

export default async function GroupQueuePage() {
  const p = await getPrincipal();
  if (!p || !p.cabiesId) return <Denied />;

  const repo = await getRepo();
  const month = await currentMonth(repo);
  const reports = await loadGroupReports(repo, p, month);

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>GROUP rater queue — {month}</h1>
      <p style={{ color: "#646767", fontSize: 13, marginBottom: 20 }}>
        Everyone with a GROUP item tagged for your group(s). Defaults are pre-filled at the maximum;
        change a value only if it needs to be lower.
      </p>

      {reports.length === 0 ? (
        <p style={{ color: "#646767" }}>No one is waiting on a GROUP score from you this month.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reports.map((r) => (
            <Link key={r.cabiesId} href={`/queue/group/${r.cabiesId}`} style={card}>
              <div style={{ fontWeight: 600 }}>{r.name}{r.cabiesId === p.cabiesId ? " (you)" : ""}</div>
              <div style={{ fontSize: 13, color: "#646767" }}>{r.designation}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 8, padding: "14px 16px", display: "block", textDecoration: "none", color: "#111" };

function Denied() {
  return <main style={wrap}><p>Not authorised.</p><Link href="/">← Home</Link></main>;
}