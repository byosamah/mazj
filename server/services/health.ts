import "server-only";

import { pingDatabase } from "../db/health";
import type { AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";

/**
 * Liveness and dependency check.
 *
 * Deliberately a real database round trip rather than a hardcoded `{ok:true}`.
 * A health check that cannot fail tells you nothing; this one exercises the
 * whole chain (environment parsing, client construction, network, credentials,
 * PostgREST) so that a green result actually means something.
 *
 * It reports latency because that is the number worth watching from Saudi
 * Arabia: the difference between a well-placed region and a badly-placed one
 * shows up here first.
 */

export type HealthReport = {
  status: "ok";
  database: { reachable: true; latencyMs: number };
};

export async function checkHealth(): Promise<Result<HealthReport, AppError>> {
  const startedAt = Date.now();
  const ping = await pingDatabase();
  const latencyMs = Date.now() - startedAt;

  if (!ping.ok) return err(ping.error);

  return ok({
    status: "ok",
    database: { reachable: true, latencyMs },
  });
}
