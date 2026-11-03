// Server helper: the signed-in person's Principal, built from the Sheet (or sample data).
import { auth } from "@/auth";
import { buildPrincipal } from "@/lib/auth/principal";
import { getRepo } from "@/lib/sheets/getRepo";
import type { Principal } from "@/lib/domain/rbac/types";

export async function getPrincipal(): Promise<Principal | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const bootstrap = (process.env.BOOTSTRAP_HR_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  return buildPrincipal(email, await getRepo(), bootstrap);
}
