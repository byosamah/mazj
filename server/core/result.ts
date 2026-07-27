/**
 * A success-or-failure value, so that expected failures travel as data.
 *
 * Throwing is reserved for genuine programmer error and unrecoverable faults.
 * Everything a caller might reasonably want to handle (invalid input, a rate
 * limit, a conflict, an upstream outage) comes back as `Result`, which means the
 * type checker forces every call site to acknowledge the failure case instead of
 * discovering it in production at 2am.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/** Applies `fn` to a success value, passing failures straight through. */
export function map<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/** Chains an operation that may itself fail. */
export function andThen<T, U, E>(
  r: Result<T, E>,
  fn: (v: T) => Result<U, E>
): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

/**
 * Unwraps a success or throws.
 *
 * For tests and for the top of a call stack where a failure genuinely is
 * unrecoverable. Reaching for this inside a service usually means the failure
 * should have been modelled instead.
 */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap() on a failed Result: ${JSON.stringify(r.error)}`);
}
