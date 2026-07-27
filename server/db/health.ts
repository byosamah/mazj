import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Liveness probe.
 *
 * 🔴 Deliberately calls `public.health_ping()` rather than querying a table.
 * This used to `select` from `leads`, which coupled the health check to a
 * business table: dropping that table took the health endpoint down with it.
 * A health check must depend on nothing but the database being reachable, so
 * that it keeps answering while the schema around it changes.
 */
export async function pingDatabase(): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin().rpc("health_ping");

    if (error) {
      return err(
        errors.upstreamUnavailable(`database ping failed: ${error.message}`, {
          cause: error,
        })
      );
    }
    return ok();
  } catch (cause) {
    return err(fromUnknown(cause, "database ping"));
  }
}
