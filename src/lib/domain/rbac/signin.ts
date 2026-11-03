// Sign-in gate — developer-spec §14.1. Pure: caller supplies the facts.

export type SignInDenyReason =
  | "EMAIL_NOT_VERIFIED"
  | "DOMAIN_NOT_ALLOWED"
  | "NOT_IN_USERS"
  | "INACTIVE"
  | "LEFT_AND_FINAL_CYCLE_CLOSED";

export type SignInDecision = { ok: true; via: "USERS" | "BOOTSTRAP" } | { ok: false; reason: SignInDenyReason };

export interface SignInFacts {
  email: string;
  emailVerified: boolean;
  allowedDomains: readonly string[];
  /** Row from Users matched by email (case-insensitive), or null. */
  user: { status: "ACTIVE" | "LEFT" | "INACTIVE" } | null;
  /** For LEFT users: true once the cycle containing their final period is CLOSED. */
  finalCycleClosed: boolean;
  /** BOOTSTRAP_HR_EMAILS — only honoured while the Users tab has no rows. */
  bootstrapHrEmails: readonly string[];
  usersTabIsEmpty: boolean;
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function evaluateSignIn(f: SignInFacts): SignInDecision {
  if (!f.emailVerified) return { ok: false, reason: "EMAIL_NOT_VERIFIED" };

  const domain = emailDomain(f.email);
  const allowed = f.allowedDomains.map((d) => d.trim().toLowerCase());
  if (!domain || !allowed.includes(domain)) return { ok: false, reason: "DOMAIN_NOT_ALLOWED" };

  if (!f.user) {
    const email = f.email.trim().toLowerCase();
    const boot = f.bootstrapHrEmails.map((e) => e.trim().toLowerCase());
    if (f.usersTabIsEmpty && boot.includes(email)) return { ok: true, via: "BOOTSTRAP" };
    return { ok: false, reason: "NOT_IN_USERS" };
  }

  switch (f.user.status) {
    case "ACTIVE":
      return { ok: true, via: "USERS" };
    case "LEFT":
      // Leavers keep access until their final cycle closes (they enter their own Self points).
      return f.finalCycleClosed ? { ok: false, reason: "LEFT_AND_FINAL_CYCLE_CLOSED" } : { ok: true, via: "USERS" };
    default:
      return { ok: false, reason: "INACTIVE" };
  }
}
