import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/session";
import { getRepo } from "@/lib/sheets/getRepo";
import { loadMissingReport } from "../../../lib/actions/missingItems";

export default function MissingPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <Report />
    </Suspense>
  );
}

async function Report() {
  const principal = await getPrincipal();
  if (!principal) redirect("/login");
  if (!principal.userTypes.has("HR")) redirect("/");

  const repo = await getRepo();
  const report = await loadMissingReport(principal, repo);

  if (!report) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Missing scores</h1>
        <p>No cycle is open right now.</p>
      </main>
    );
  }

  if (!report.deadlinePassed) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Missing scores — {report.month}</h1>
        <p>
          The entry deadline ({report.entryDeadline}) hasn&apos;t passed yet, so blanks are
          still normal. Check back after that date.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1>Missing scores — {report.month}</h1>
      <p>
        Entry deadline was {report.entryDeadline}. {report.items.length} score
        {report.items.length === 1 ? "" : "s"} still blank.
      </p>
      {report.items.length === 0 ? (
        <p>Nothing missing — everyone&apos;s caught up.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th style={{ padding: 8 }}>Employee</th>
              <th style={{ padding: 8 }}>Designation</th>
              <th style={{ padding: 8 }}>Component</th>
              <th style={{ padding: 8 }}>Question</th>
              <th style={{ padding: 8 }}>Responsible</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item, i) => (
              <tr key={`${item.cabiesId}-${i}`} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: 8 }}>{item.name}</td>
                <td style={{ padding: 8 }}>{item.designation}</td>
                <td style={{ padding: 8 }}>{item.component}</td>
                <td style={{ padding: 8 }}>{item.question}</td>
                <td style={{ padding: 8 }}>{item.responsible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}