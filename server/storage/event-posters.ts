import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";
import { env } from "../env";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Event posters, in Supabase Storage.
 *
 * The bucket is created by `20260728120000_events.sql` with public READ and NO
 * policy on `storage.objects`, so `anon` and `authenticated` can neither upload
 * nor overwrite nor delete. The only writer is the secret key, reached only
 * from an authenticated admin action.
 *
 * Public read is deliberate: a poster sits on a public marketing page and a
 * signed URL would expire while somebody was still scrolling.
 */

export const POSTER_BUCKET = "event-posters";

/**
 * What a poster may be.
 *
 * Enforced here AND on the bucket itself. This copy is the one that gives a
 * human a sensible error; the bucket's copy is the one that still holds when
 * somebody adds a second upload path in a year and forgets this file exists.
 */
export const POSTER_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const POSTER_ACCEPT = Object.keys(ALLOWED).join(",");

/**
 * The public URL for a stored poster.
 *
 * Built by hand rather than through `getPublicUrl` so it can be called from a
 * plain view model without constructing a Supabase client, and so the shape is
 * visible in one place if the bucket is ever renamed.
 */
export function posterPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${env().SUPABASE_URL}/storage/v1/object/public/${POSTER_BUCKET}/${path}`;
}

/**
 * Stores a poster and returns its object path.
 *
 * 🔴 THE UPLOADED FILENAME IS DISCARDED. The stored name is generated.
 *
 * A caller-supplied filename lands in a public URL, and it arrives from a form
 * as an arbitrary string: `../`, a leading slash, a name that collides with an
 * existing poster and silently replaces it, or a `.jpg` that is actually
 * something else. Generating the name removes the entire class rather than
 * trying to sanitise it, and costs nothing, because nobody reads a poster's
 * filename.
 *
 * 🔴 The extension comes from the declared MIME TYPE, and the type is checked
 * against an allowlist rather than a denylist. An allowlist is wrong only in
 * ways that refuse a legitimate file; a denylist is wrong in ways that accept a
 * hostile one.
 */
export async function uploadPoster(
  file: File
): Promise<Result<string, AppError>> {
  const extension = ALLOWED[file.type];
  if (!extension) {
    return err(
      errors.validation("The poster has to be a JPG, PNG or WebP image.", {
        poster: "type",
      })
    );
  }

  if (file.size === 0) {
    return err(errors.validation("That poster file is empty.", { poster: "empty" }));
  }

  if (file.size > POSTER_MAX_BYTES) {
    return err(
      errors.validation("The poster has to be under 5 MB.", { poster: "size" })
    );
  }

  // Date-prefixed so the bucket stays browsable by a human in the Supabase
  // dashboard, and random-suffixed so two uploads in the same millisecond
  // cannot collide. `crypto.randomUUID` is available on the Node runtime these
  // routes pin.
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error } = await supabaseAdmin()
      .storage.from(POSTER_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        // Never overwrite. A generated name should never collide, and if one
        // ever did, silently replacing another event's poster is worse than an
        // error nobody sees.
        upsert: false,
        // Posters are immutable: a new poster is a new object, so the old URL
        // is never reused and a long cache is safe.
        cacheControl: "31536000",
      });

    if (error) {
      return err(
        errors.upstreamUnavailable(`poster upload failed: ${error.message}`, {
          cause: error,
        })
      );
    }

    return ok(path);
  } catch (cause) {
    return err(fromUnknown(cause, "poster upload"));
  }
}

/**
 * Removes a poster that is no longer referenced.
 *
 * Best effort by design: an orphaned object costs a few kilobytes, while
 * failing an event update because a cleanup failed costs the owner their work.
 */
export async function deletePoster(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await supabaseAdmin().storage.from(POSTER_BUCKET).remove([path]);
  } catch {
    // Deliberately swallowed. See above.
  }
}
