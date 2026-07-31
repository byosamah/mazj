import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { log } from "../core/logger";
import { err, ok, type Result } from "../core/result";
import { env } from "../env";

/**
 * Sending transactional email, through Resend.
 *
 * Written against Resend's REST endpoint with plain `fetch` rather than their
 * SDK, for the same reason `rekaz/client.ts` is: one POST to one URL does not
 * justify a dependency in a serverless bundle, and the SDK's real value
 * (retries, React templates) is either unwanted here or already solved.
 *
 * 🔴 THERE IS NO QUEUE AND NO SILENT SUCCESS. If this cannot send, it returns a
 * typed error naming what is wrong, and the caller records that against the
 * thing it failed to announce. An unconfigured mailer that reports success is
 * the worst possible outcome: the owner believes a founder was told, and the
 * founder believes MAZJ ignored them.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * ⚠️ Shorter than the Rekaz client's 10s on purpose. Every send here happens
 * INSIDE a Server Action a human is waiting on, after the database write that
 * actually matters has already committed. Ten seconds of spinner to deliver an
 * email that will arrive whenever it arrives is the wrong trade; the decision is
 * already safe by the time we get here.
 */
const TIMEOUT_MS = 8000;

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  /**
   * 🔴 Required, not optional.
   *
   * A multipart message with no text part is a well-known spam signal, and the
   * text part is also what renders in a watch notification, a screen reader and
   * every mail client with images off. An HTML-only branded email is a
   * beautiful message a meaningful number of people never actually read.
   */
  text: string;
};

export type EmailConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
  alertTo?: string;
  siteOrigin: string;
};

/**
 * The email configuration, or an error naming exactly what is missing.
 *
 * Resolved per call rather than at module scope, because these variables are
 * optional in `server/env.ts` and a module-scope throw here would propagate to
 * anything that imports this file. See the comment block on those fields.
 */
export function emailConfig(): Result<EmailConfig, AppError> {
  const {
    RESEND_API_KEY,
    EMAIL_FROM,
    EMAIL_REPLY_TO,
    EMAIL_ALERT_TO,
    SITE_URL,
  } = env();

  const missing: string[] = [];
  if (!RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!EMAIL_FROM) missing.push("EMAIL_FROM");
  if (!SITE_URL) missing.push("NEXT_PUBLIC_SITE_URL");

  if (missing.length > 0 || !RESEND_API_KEY || !EMAIL_FROM || !SITE_URL) {
    // Named individually so the admin screen can print something actionable
    // rather than "email failed". Whoever reads this is the person who can fix
    // it, and they are looking at a hosting dashboard.
    return err(
      errors.internal(
        `Email is not configured. Missing: ${missing.join(", ")}. ` +
          `Set these on the deployment, and verify the sending domain in Resend first.`
      )
    );
  }

  return ok({
    apiKey: RESEND_API_KEY,
    from: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO,
    alertTo: EMAIL_ALERT_TO,
    siteOrigin: SITE_URL,
  });
}

/**
 * Sends one message.
 *
 * Returns the provider's message id on success, which is the only handle that
 * can answer "did it actually go" in Resend's own dashboard three days later.
 */
export async function sendEmail(
  message: OutboundEmail,
  config: EmailConfig
): Promise<Result<{ id: string }, AppError>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        // Explicit, for the reason the Rekaz client learned the hard way: an API
        // that filters on User-Agent answers 403 to an unrecognised client, and
        // that reads exactly like an expired credential. Node's default passes
        // today; a runtime upgrade that changes it should not become a mystery.
        "User-Agent": "mazj-server/email",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        // Snake case: this is the REST field name. The `replyTo` spelling
        // belongs to their Node SDK, which maps it to this one.
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    // Read once. The body is needed on both paths and a Response body can only
    // be consumed a single time.
    const body = await response.text();

    if (!response.ok) {
      // 🔴 Truncated, and it goes to the LOG, never to a browser. Provider error
      // bodies quote the payload back, which on this path contains the
      // applicant's address and the whole message. `toPublicError` strips
      // `internal` messages, and the admin screen prints a short summary, but
      // the discipline is worth stating: nothing from here is user-facing copy.
      log.error("email.send_failed", {
        status: response.status,
        // Not `body` or `response`: neither matches the logger's denylist, so
        // the raw provider payload would be written out in full. Bounded and
        // named for what it is.
        providerDetail: body.slice(0, 300),
      });

      return err(
        response.status === 429
          ? errors.rateLimited("Email provider is rate limiting us.", 60)
          : response.status === 403 || response.status === 401
            ? errors.internal(
                `Email provider refused the request (${response.status}). ` +
                  `Usually an unverified sending domain or a bad API key.`
              )
            : errors.upstreamUnavailable(
                `Email provider answered ${response.status}.`
              )
      );
    }

    const parsed = safeParseId(body);
    if (!parsed) {
      // A 2xx with no id is not a success we can evidence. Treated as a failure
      // so the row records it, rather than claiming a delivery nobody can trace.
      return err(errors.upstreamUnavailable("Email provider returned no id."));
    }

    log.info("email.sent", { providerId: parsed });
    return ok({ id: parsed });
  } catch (cause) {
    // An abort lands here too. Named, because "TypeError: fetch failed" on this
    // path has one overwhelmingly likely cause in this repo and it is not the
    // provider: the command sandbox breaks Node's outbound TLS. See
    // server/CLAUDE.md.
    if (cause instanceof Error && cause.name === "AbortError") {
      return err(
        errors.upstreamUnavailable(`Email provider timed out after ${TIMEOUT_MS}ms.`)
      );
    }
    return err(fromUnknown(cause, "email send"));
  } finally {
    clearTimeout(timer);
  }
}

function safeParseId(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id ? parsed.id : null;
  } catch {
    return null;
  }
}
