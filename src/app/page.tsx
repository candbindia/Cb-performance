import Link from "next/link";
import { signOut } from "@/auth";
import { getPrincipal } from "@/lib/auth/session";
import { usingSampleData } from "@/lib/sheets/getRepo";

export const instant = false;

export default async function Home() {
  const p = await getPrincipal();
  const isHR = p?.userTypes.has("HR");
  const isMD = p?.userTypes.has("MANAGEMENT");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", background: "#FAF8F3" }}>
      <div style={{ textAlign: "center", color: "#111" }}>
        <h1>C&amp;B Performance</h1>
        <p style={{ color: "#646767" }}>Signed in as <strong>{p?.email}</strong></p>
        {usingSampleData() && (
          <p style={{ color: "#8a6d3b", fontSize: 13 }}>Using sample data (the Google Sheet is not connected yet)</p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
          {isHR && <Link href="/hr" style={btn}>HR dashboard</Link>}
          {isMD && <Link href="/md" style={btn}>MD dashboard</Link>}
          {!isHR && !isMD && <span style={{ color: "#646767" }}>No dashboards for your role yet.</span>}
        </div>

        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button type="submit" style={{ marginTop: 24, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Sign out</button>
        </form>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = { background: "#F2AC3C", color: "#111", padding: "10px 18px", borderRadius: 8, fontWeight: 600, textDecoration: "none" };
