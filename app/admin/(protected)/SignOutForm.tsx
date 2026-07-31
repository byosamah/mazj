import { signOut } from "../_lib/actions";

/**
 * Sign out, as a server component handed to the client `Sidebar` as a prop.
 *
 * 🔴 That indirection is the point. `Sidebar` is a client component, so anything
 * it imports ships to the browser, and `_lib/actions.ts` is a sanctioned
 * crossing into `@/server` that can reach the Supabase secret key and the
 * admin-scope Rekaz credential. Passing the rendered form DOWN keeps the import
 * on the server side of the boundary and leaves `Sidebar`'s import list at
 * `next/link`, `next/navigation`, the plain nav data and three icons.
 *
 * `signOut` is deliberately unguarded (`UNGUARDED_BY_DESIGN` in
 * `test/admin-page-guards.test.ts`): requiring a session to END one strands
 * anyone whose token has just expired on a page whose only button cannot work.
 *
 * It renders TWICE, once in the rail foot and once in the phone header, which is
 * why the height is responsive rather than fixed. Below `lg` it sits inside a
 * 48px bar, where a 44px control reads as the bar itself; the `before:` pseudo
 * restores the 44px hit area the visible 36px box gives up. That is the same
 * hit-pad idiom the marketing site uses on its own small controls, and it is
 * why a rect-only tap-target audit under-reports here.
 */
export default function SignOutForm() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="relative inline-flex h-9 w-full items-center justify-center rounded border border-border px-4 text-14 font-medium [transition:opacity_200ms,transform_120ms] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 hover:bg-accent active:scale-[0.96] lg:h-11"
      >
        Sign out
      </button>
    </form>
  );
}
