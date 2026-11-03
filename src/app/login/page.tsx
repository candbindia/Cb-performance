import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 8 }}>C&amp;B Performance</h1>
        <p style={{ color: "#646767", marginBottom: 24 }}>Sign in with your C&amp;B Google account</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{ background: "#F2AC3C", color: "#111", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
