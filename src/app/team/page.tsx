// A quick view of "my direct reports" status, for Team Leads / Managers.
// Reads sample Users + ItemEvents-shaped status (no real ItemEvents tab is wired yet,
// so each report's items are shown as not-yet-entered until the entry screens exist).
import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { getTeamStatus } from "@/lib/actions/teamStatus";

export const instant = false;

export default async function TeamStatusPage() {
  const p = await getPrincipal();
  if (!p) return <Denied />;

  const users = await (await getRepo()).readUsers();
  const reports = users.filter((u) => u.rmCabiesId === p.cabiesId && u.status === "ACTIVE");

  // No ItemEvents reader yet (next step), so every report shows as having no items entered yet.
  const status = getTeamStatus(
    p,
    reports.map((r) => ({ cabiesId: r.cabiesId, name: r.name, itemStatuses: [] })),
  );

  return (
    <main style={wrap}>
      <Header title="My team" />
      {status.length === 0 ? (
        <p style={{ color: "#646767" }}>Nobody reports to you.</p>
      ) : (
        <table style={table}>
          <thead><tr><Th>Name</Th><Th>Entered</Th><Th>Missing</Th></tr></thead>
          <tbody>
            {status.map((r) => (
              <tr key={r.cabiesId}>
                <Td>{r.name}</Td>
                <Td>{r.allEntered ? "Yes" : "No"}</Td>
                <Td>{r.hasMissing ? "Yes" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ color: "#646767", fontSize: 13, marginTop: 20 }}>
        Item-level status will fill in once the entry screens and ItemEvents reading are built.
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", background: "#fff", borderRadius: 8, overflow: "hidden" };
function Header({ title }: { title: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><h1 style={{ fontSize: 22 }}>{title}</h1><Link href="/" style={{ color: "#646767" }}>← Home</Link></div>;
}
const Th = ({ children }: { children: React.ReactNode }) => <th style={{ textAlign: "left", padding: "10px 14px", background: "#646767", color: "#fff", fontSize: 13 }}>{children}</th>;
const Td = ({ children }: { children: React.ReactNode }) => <td style={{ padding: "10px 14px", borderBottom: "1px solid #eee" }}>{children}</td>;
function Denied() { return <main style={wrap}><p>Not authorised. <Link href="/">← Home</Link></p></main>; }
