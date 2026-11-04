// My team: your direct reports, and how many of the RM-rated scores you have entered for each.
import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { loadReports, loadReportQuestions, currentMonth } from "@/lib/actions/teamQueue";

export const instant = false;

export default async function TeamPage() {
  const p = await getPrincipal();
  if (!p || !p.cabiesId) return <Denied />;

  const repo = await getRepo();
  const month = await currentMonth(repo);
  const reports = await loadReports(repo, p.cabiesId);
  const rows = await Promise.all(
    reports.map(async (r) => {
      const qs = await loadReportQuestions(repo, r, month);
      return { r, total: qs.length, entered: qs.filter((q) => q.state.status !== "NOT_ENTERED").length };
    }),
  );

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>My team — {month}</h1>
          <p style={{ color: "#646767", fontSize: 13 }}>Scores you rate for your direct reports</p>
        </div>
        <Link href="/" style={{ color: "#646767" }}>← Home</Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "#646767" }}>Nobody reports to you.</p>
      ) : (
        <table style={table}>
          <thead>
            <tr><Th>Name</Th><Th>Designation</Th><Th>Entered</Th><Th></Th></tr>
          </thead>
          <tbody>
            {rows.map(({ r, total, entered }) => (
              <tr key={r.cabiesId}>
                <Td>{r.name}</Td>
                <Td>{r.designation}</Td>
                <Td>{entered} / {total}</Td>
                <Td><Link href={`/team/${r.cabiesId}`} style={{ color: "#111", fontWeight: 600 }}>Open →</Link></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", background: "#fff", borderRadius: 8, overflow: "hidden" };
const Th = ({ children }: { children?: React.ReactNode }) => <th style={{ textAlign: "left", padding: "10px 14px", background: "#646767", color: "#fff", fontSize: 13 }}>{children}</th>;
const Td = ({ children }: { children?: React.ReactNode }) => <td style={{ padding: "10px 14px", borderBottom: "1px solid #eee" }}>{children}</td>;

function Denied() {
  return <main style={wrap}><p>Not authorised.</p><Link href="/">← Home</Link></main>;
}