import "server-only";

import type { NormalizedLead } from "../domain/leads";
import { errors, fromUnknown, type AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";
import { supabaseAdmin } from "../supabase/admin";
import type { Database } from "../supabase/types.gen";

/**
 * Data access for `public.leads`.
 *
 * Rows in, rows out. No business rules live here: this layer's only job is to
 * turn a domain object into a row and a database error into an `AppError`, so
 * that nothing above it has to know what PostgREST error codes mean.
 */

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export type StoredLead = {
  id: string;
  createdAt: string;
};

const PG_CHECK_VIOLATION = "23514";

export async function insertLead(
  lead: NormalizedLead,
  meta: { ipHash: string | null }
): Promise<Result<StoredLead, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("leads")
      .insert({
        full_name: lead.fullName,
        email: lead.email,
        phone_e164: lead.phoneE164,
        interest: lead.interest,
        note: lead.note,
        locale: lead.locale,
        source: lead.source,
        page_path: lead.pagePath,
        consent_at: lead.consentAt,
        ip_hash: meta.ipHash,
      })
      .select("id, created_at")
      .single<Pick<LeadRow, "id" | "created_at">>();

    if (error) {
      // A check violation means the domain layer let something through that the
      // database refused. That is our bug, not the caller's, so it is reported
      // as a validation failure to them and logged as an internal problem for
      // us by the service above.
      if (error.code === PG_CHECK_VIOLATION) {
        return err(
          errors.validation(
            "That submission could not be accepted.",
            { _: "failed a database constraint" }
          )
        );
      }
      return err(
        errors.upstreamUnavailable(`lead insert failed: ${error.message}`, {
          cause: error,
        })
      );
    }

    return ok({ id: data.id, createdAt: data.created_at });
  } catch (cause) {
    return err(fromUnknown(cause, "lead insert"));
  }
}

/** Liveness probe: cheapest possible round trip that still proves the path. */
export async function pingDatabase(): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .limit(1);

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
