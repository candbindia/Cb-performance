// Auth.js (next-auth v5): Google sign-in plus the C&B gate. The gate reads the real Users tab.
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { evaluateSignIn, type SignInFacts } from "@/lib/domain/rbac/signin";
import { getRepo } from "@/lib/sheets/getRepo";
import type { UserRow } from "@/lib/domain/org/overview";

const lc = (s: string) => s.trim().toLowerCase();
const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function normaliseStatus(s: string | undefined): "ACTIVE" | "LEFT" | "INACTIVE" {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "" || v === "ACTIVE") return "ACTIVE";
  if (v === "LEFT") return "LEFT";
  return "INACTIVE"; // anything unrecognised fails closed
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? "";

      let rows: UserRow[] = [];
      try {
        rows = await (await getRepo()).readUsers();
      } catch (err) {
        // Sheet unreachable: treat as empty so only BOOTSTRAP_HR_EMAILS can get in (break-glass).
        // Everyone else is still refused below.
        console.error("[signin] could not read the Users tab", err);
      }

      const row = rows.find((u) => lc(u.email ?? "") === lc(email));

      const facts: SignInFacts = {
        email,
        emailVerified: Boolean((profile as { email_verified?: boolean })?.email_verified),
        allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
        user: row ? { status: normaliseStatus(row.status) } : null,
        finalCycleClosed: false, // no Cycles tab yet, so leavers keep access until it exists
        bootstrapHrEmails: list(process.env.BOOTSTRAP_HR_EMAILS),
        usersTabIsEmpty: rows.length === 0,
      };

      const decision = evaluateSignIn(facts);
      if (!decision.ok) console.warn(`[signin] denied ${email}: ${decision.reason}`);
      return decision.ok;
    },
  },
});