import "server-only";

import {
  completeAdminSignIn,
  type SignInParams,
} from "@/server/services/admin-auth";

import { adminSupabase } from "./supabase";

/**
 * The magic-link verification, for the callback route.
 *
 * Separate from `actions.ts` because that file is `"use server"`, which turns
 * every one of its exports into a callable Server Action. `completeAdminSignIn`
 * takes a Supabase client, which is not serialisable, so re-exporting it there
 * would create an action that cannot be invoked and would widen the public
 * surface for no reason.
 *
 * This file is also what lets `app/admin/auth/callback/route.ts` reach the
 * backend at all: the ESLint boundary only exempts `app/admin/_lib/**`, so the
 * route imports this and this imports `@/server`. The crossing stays in the one
 * folder that is allowed to make it.
 */
export async function verifyMagicLink(
  params: SignInParams
): Promise<{ ok: boolean }> {
  const supabase = await adminSupabase();
  const result = await completeAdminSignIn(supabase, params);
  return { ok: result.ok };
}
