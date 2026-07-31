import BookingSkeleton from "../../_lib/BookingSkeleton";

/**
 * What `/spaces/private-office/book` shows while it waits for Rekaz.
 *
 * Three lines of route, like the `page.tsx` beside it: the frame lives in
 * `_lib/BookingSkeleton`, and so does the reasoning for why it carries no words,
 * no motion and no physical direction.
 */
export default function Loading() {
  return <BookingSkeleton />;
}
