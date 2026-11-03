import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { can } from "@/lib/domain/rbac/permissions";
import { getRepo } from "@/lib/sheets/getRepo";

export const instant = false;

export default async function HRDashboard() {
  const p = await getPrincipal();
  if (!p || !can(p, { type: "MANAGE_KPI_PARAMS" }).allowed) return <Denied />;

  const rows = await (await getRepo()).readKpiParams();
  // group by unit -> designation -> component
  const groups = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.unit} · ${r.designation} · ${r.component}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }

  return (
    <main style={wrap}>
      <Header title="HR dashboard — KPI parameters" />
      <p style={{ color: "#646767", marginBottom: 16 }}>{rows.length} parameter rows across {groups.size} role sets.</p>
      <table style={table}>
        <thead><tr><Th>Unit · Designation · Component</Th><Th>Questions</Th></tr></thead>
        <tbody>
          {[...groups.entries()].map(([k, n]) => (<tr key={k}><Td>{k}</Td><Td>{n}</Td></tr>))}
        </tbody>
      </table>
      <p style={{ color: "#646767", fontSize: 13, marginTop: 20 }}>
        Adding and editing parameter sets from here comes next. For now this is the read view.
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
