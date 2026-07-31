import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * 🔴 THE NUMERIC TYPE SCALE HAS TO BE TAUGHT TO tailwind-merge, OR IT DELETES IT.
 *
 * `tailwind.config.ts` defines the MAZJ scale as `fontSize: { "8": "8px", …
 * "85": "85px" }`, so `text-11` and `text-45` are font sizes here. tailwind-merge
 * does not read the Tailwind config. It ships a fixed table in which the only
 * font sizes are `text-xs` through `text-9xl`, and it files every OTHER `text-*`
 * value under COLOUR. `text-11` therefore looked like a colour, collided with the
 * real colour beside it, and lost, because a merge keeps the last member of a
 * conflicting pair:
 *
 *     twMerge("text-11 text-subtle-foreground")  ->  "text-subtle-foreground"
 *     twMerge("text-13 text-ok")                 ->  "text-ok"
 *
 * The size was not overridden, it was REMOVED, and the element then inherited
 * 16px. This is the exact failure `CLAUDE.md` warns about ("a size outside the
 * set silently applies nothing and the element inherits 16px") arriving through a
 * completely different door: not Tailwind failing to emit the class, but this
 * function deleting a class Tailwind emitted correctly. Nothing errors, no test
 * notices, and the compiled CSS is perfect. Only the rendered page is wrong.
 *
 * Measured 2026-07-29 against tailwind-merge 3.x. It reached nearly every admin
 * primitive, since pairing a size with a colour is the commonest thing a class
 * list does.
 *
 * `extend` APPENDS to the built-in group, so `text-xs`/`text-sm`/`text-base`
 * keep working exactly as before; this only adds the bare-integer spellings.
 *
 * ⚠️ Scoped to `cn()`, so it never affected the marketing site: nothing outside
 * `components/ui/` and `components/admin/` calls this function. Those components
 * compose their classes literally.
 *
 * 🔴 THE VALIDATOR MUST BE A FUNCTION. tailwind-merge accepts a class-group
 * member as a literal string, a nested object, or a `(value: string) => boolean`
 * validator. It does NOT accept a RegExp: one is neither a string nor callable,
 * so it matches nothing and is silently ignored, and the whole extension becomes
 * a no-op that looks exactly like a fix. `/^\d+$/` was tried first and behaved
 * identically to no config at all. Verified across 16 cases.
 */
const isNumericFontSize = (value: string) => /^\d+$/.test(value);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [isNumericFontSize] }],
    },
  },
});

/**
 * Merge Tailwind classes, letting the later one win.
 *
 * Added 2026-07-29 with the shadcn primitives under `components/ui/`, which all
 * expect it at this exact path (`@/lib/utils`) because that is where the shadcn
 * registry writes its import. Renaming or moving it breaks every component the
 * registry generates from here on.
 *
 * Why `twMerge` and not plain `clsx`: Tailwind's output order, not the class
 * string's order, decides which of two conflicting utilities wins. So a
 * component whose base variant sets `px-4` cannot be overridden by a caller
 * passing `px-6` unless something resolves the conflict first. `twMerge` drops
 * the earlier member of each conflicting pair, which is what makes
 * `<Button className="px-6">` behave the way everyone expects it to.
 *
 * 🔴 It is deliberately NOT used by the marketing site. Every component under
 * `components/` outside `ui/` and `admin/` composes its classes literally, and
 * that is worth keeping: a literal class list is greppable, and this repo has
 * been bitten before by a format-on-save linter rewriting Tailwind values it
 * could see. Values hidden behind a merge function are values it cannot.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
