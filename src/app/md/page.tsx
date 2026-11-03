import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { getOrgOverview } from "@/lib/actions/md";
import { getRepo } from "@/lib/sheets/getRepo";

export const instant = false;

export default async function MDDashboard() {
  const p = await getPrincipal();
  if (!p) return <Denied />;
  let overview;
  try {
    overview = await getOrgOverview(p, await getRepo());
  } catch {
    return <Denied />;
  }

  return (
    <main style={wrap}>
      <Header title="MD dashboard — organisation overview" />
      <section style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Stat label="Active staff" value={overview.headcountActive} />
        <Stat label="Appraised" value={overview.appraisedCount} />
        <Stat label="Exempt (MDs)" value={overview.exemptCount} />
      </section>

      <h3>By department</h3>
      <table style={table}>
        <thead><tr><Th>Department</Th><Th>Active</Th><Th>Appraised</Th></tr></thead>
        <tbody>
          {overview.byDepartment.map((d) => (
            <tr key={d.deptId}><Td>{d.name}</Td><Td>{d.active}</Td><Td>{d.appraised}</Td></tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>By designation</h3>
      <table style={table}>
        <thead><tr><Th>Designation</Th><Th>Active</Th></tr></thead>
        <tbody>
          {overview.byDesignation.map((d) => (
            <tr key={d.designation}><Td>{d.designation}</Td><Td>{d.active}</Td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#FAF8F3", color: "#111", fontFamily: "system-ui", padding: 32, maxWidth: 820, margin: "0 auto" };
const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", background: "#fff", borderRadius: 8, overflow: "hidden" };
function Header({ title }: { title: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}><h1 style={{ fontSize: 22 }}>{title}</h1><Link href="/" style={{ color: "#646767" }}>← Home</Link></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div style={{ background: "#fff", borderRadius: 8, padding: "16px 24px", minWidth: 120 }}><div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div><div style={{ color: "#646767", fontSize: 13 }}>{label}</div></div>;
}
const Th = ({ children }: { children: React.ReactNode }) => <th style={{ textAlign: "left", padding: "10px 14px", background: "#646767", color: "#fff", fontSize: 13 }}>{children}</th>;
const Td = ({ children }: { children: React.ReactNode }) => <td style={{ padding: "10px 14px", borderBottom: "1px solid #eee" }}>{children}</td>;
function Denied() { return <main style={wrap}><p>Not authorised. <Link href="/">← Home</Link></p></main>; }
