import { getPrincipal } from "@/lib/auth/session";
import { makeGoogleRepo } from "@/lib/sheets/googleRepo";
import { applyGroupDefaults } from "@/lib/actions/cycleDefaults";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function ResultBanner({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      {sp.result && (
        <p style={{ marginTop: "1rem", padding: "1rem", background: "#d4edda", borderRadius: 8 }}>
          ✅ {sp.result}
        </p>
      )}
      {sp.error && (
        <p style={{ marginTop: "1rem", padding: "1rem", background: "#f8d7da", borderRadius: 8 }}>
          ❌ {sp.error}
        </p>
      )}
    </>
  );
}

export default function DefaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; error?: string }>;
}) {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Apply GROUP Defaults</h1>
      <p>Writes max points for all GROUP items. Skips items where the person is in the rater group.</p>

      <form action={runDefaults}>
        <label>
          Month:{" "}
          <input name="month" defaultValue="2026-09" pattern="\d{4}-\d{2}" required />
        </label>
        <br /><br />
        <button type="submit">Apply Defaults</button>
      </form>

      <Suspense>
        <ResultBanner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function runDefaults(formData: FormData) {
  "use server";
  const principal = await getPrincipal();
  if (!principal) redirect("/login");
  const month = formData.get("month") as string;
  const repo = makeGoogleRepo();

  try {
    const run = await applyGroupDefaults(principal, repo, month, new Date().toISOString());
    redirect(
      `/admin/default?result=${encodeURIComponent(
        `Done! ${run.defaulted} defaults written, ${run.skippedSelf} self-items skipped.`
      )}`
    );
  } catch (e: any) {
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(`/admin/default?error=${encodeURIComponent(e.message)}`);
  }
}