import { errors } from "@/server/core/errors";
import { errorResponse, readJson, respond, route } from "@/server/core/http";
import { createLead } from "@/server/services/leads";

/**
 * `POST /api/leads` — record that someone is interested in a space.
 *
 * Optional `Idempotency-Key` header: send the same key with the same body and
 * the original response comes back instead of a second lead being created.
 *
 * Everything of consequence (rate limiting, validation, normalisation, the
 * write) happens in `server/services/leads.ts`. This file exists only to turn
 * an HTTP request into a function call.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const body = await readJson(request);
  if (!body.ok) {
    return errorResponse(
      errors.validation("The request body is not valid JSON.")
    );
  }

  const result = await createLead(body.value, request.headers);

  return respond(result, (value) => ({
    body: { id: value.id, createdAt: value.createdAt },
    // A replay reports 200 rather than 201: nothing was created this time.
    status: value.replayed ? 200 : 201,
  }));
});
