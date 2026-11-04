// Edge-safe part of the Auth.js config. No Sheets import here, so the middleware can use it.
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;