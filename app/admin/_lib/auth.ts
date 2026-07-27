import "server-only";

import { redirect } from "next/navigation";

import { isAllowedAdminEmail } from "@/server/domain/admin-access";

import { adminSupabase } from "./supabase";

/**
 * Gate 3 of 3: the check that runs on every admin request.
 *
 * Gate 1 refuses to email a link to an outsider. Gate 2 refuses to create an
 * account for one. This gate assumes both of those have already failed, because
 * a gate that trusts the gates in front of it is decoration.
 *
 * See `server/domain/admin-access.ts` for the domain rule itself, and the spec
 * at `docs/superpowers/specs/2026-07-27-admin-dashboard-design.md` for why there
 * are three.
 */

export type AdminUser = {
  id: string;
  email: string;
};

/**
 * The signed-in admin, or `null`.
 *
 * 🔴 Uses `getUser()`, never `getSession()`.
 *
 * `getSession()` reads the auth cookie and decodes it. It does not verify it.
 * The cookie is in the visitor's hands, so on a page whose entire job is
 * deciding whether to let someone in, "decode what they gave me and believe it"
 * is not authorisation. `getUser()` sends the token to the Supabase auth server
 * and gets back a verified identity, at the cost of one network call, which is
 * exactly the right trade on an internal dashboard.
 *
 * The email domain is re-checked here rather than trusted from the token.
 * Supabase lets an address be changed on an existing account, so an account
 * created legitimately on `@mazj.org` and later moved to another address must
 * stop working, and only a check at request time notices that.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await adminSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const email = data.user.email;
  if (!isAllowedAdminEmail(email)) return null;

  return { id: data.user.id, email: email as string };
}

/**
 * The signed-in admin, or a redirect to the login page.
 *
 * Called by the admin layout, so every page underneath is protected by
 * default. A new admin page is protected because it exists, not because
 * somebody remembered to protect it. That default is the point: the alternative
 * is one forgotten call away from an open page.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
