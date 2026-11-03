// Auth.js (next-auth v5) — "Sign in with Google" + the C&B sign-in gate.
// Auth.js reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment,
// so the Google provider needs no arguments here.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { evaluateSignIn, type SignInFacts } from "@/lib/domain/rbac/signin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    // Runs after Google verifies the person. We apply the gate from signin.ts.
    async signIn({ profile }) {
      const facts: SignInFacts = {
        email: profile?.email ?? "",
        emailVerified: Boolean((profile as { email_verified?: boolean })?.email_verified),
        allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean),
        // Sheets is not connected yet, so there is no Users tab to read.
        // Until it is, we treat the tab as empty and admit only BOOTSTRAP_HR_EMAILS.
        user: null,
        finalCycleClosed: false,
        bootstrapHrEmails: (process.env.BOOTSTRAP_HR_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean),
        usersTabIsEmpty: true,
      };
      return evaluateSignIn(facts).ok;
    },
  },
});
