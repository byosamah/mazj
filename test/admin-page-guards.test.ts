import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every page under `(protected)/` must authorise itself.
 *
 * The layout guard is real and it stays. What it does NOT do is stop the page
 * from running, because React renders a route's components concurrently rather
 * than parent-then-child: `redirect()` in the layout throws, the page's data
 * loader has already started, and its output is serialised into the response
 * alongside the redirect.
 *
 * Measured on this repo before the guard was added to the dashboard page: an
 * anonymous `curl http://localhost:3000/admin` returned a correct
 * `307 -> /admin/login` whose body still carried 28KB of rendered dashboard,
 * including Rekaz room names, live occupancy and the subscription totals. The
 * authorisation worked and the data escaped regardless.
 *
 * So the check has to sit above the data read, in the page. That reintroduces
 * exactly the failure the layout was designed to prevent (a new page, someone
 * in a hurry, one missing line), which is what this test is for. It is a source
 * scan rather than a runtime test on purpose: the property being defended is
 * "the call is present in every file", and that is a property of the files.
 *
 * Sibling of `test/admin-surface.test.ts`, which keeps the same area invisible
 * to crawlers.
 */

const PROTECTED_DIR = join(process.cwd(), "app", "admin", "(protected)");
const ACTIONS_FILE = join(process.cwd(), "app", "admin", "_lib", "actions.ts");

/** Every `page.tsx` at any depth under `(protected)/`. */
function protectedPages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) protectedPages(path, found);
    else if (entry.name === "page.tsx") found.push(path);
  }
  return found;
}

/**
 * Strips comments before searching for a call.
 *
 * Without this the test passes on a file that only MENTIONS `requireAdmin()` in
 * a comment, which is the exact shape of a page whose author explained the
 * guard and then forgot to write it. This repo's own CLAUDE.md records the same
 * trap in a different form: `grep -c "<img"` counted JSDoc prose as elements.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("admin pages authorise themselves", () => {
  const pages = protectedPages(PROTECTED_DIR);

  it("finds pages to check at all", () => {
    // A rename of the route group would otherwise make this whole suite pass by
    // checking nothing, which is worse than failing.
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("%s calls requireAdmin()", (page) => {
    const code = withoutComments(readFileSync(page, "utf8"));

    expect(code).toMatch(/\brequireAdmin\s*\(\s*\)/);
    expect(code).toMatch(/\bimport\s*\{[^}]*\brequireAdmin\b[^}]*\}/);
  });

  it.each(pages)("%s awaits the guard before loading any data", (page) => {
    const code = withoutComments(readFileSync(page, "utf8"));
    const guard = code.search(/\bawait\s+requireAdmin\s*\(\s*\)/);

    // An unawaited guard is a floating promise: the redirect never lands before
    // the load runs, which is the bug this file exists to prevent.
    expect(guard).toBeGreaterThan(-1);

    // Nothing that reads MAZJ's operational data may run above the guard.
    const load = code.search(/\bawait\s+load[A-Z]\w*\s*\(/);
    if (load > -1) expect(guard).toBeLessThan(load);
  });
});

describe("the layout guard stays too", () => {
  /**
   * Moving the check into the pages does not retire the layout check, and this
   * assertion exists because "the page guards itself now" is exactly the
   * argument someone would use to delete it.
   *
   * They defend different request shapes. The layout is what turns an
   * unauthenticated page view into a redirect to the login screen, which is the
   * behaviour a human gets. The page check is what stops the DATA being read
   * when the layout is skipped or when its redirect loses the race. Neither
   * covers the other.
   */
  it("app/admin/(protected)/layout.tsx still calls requireAdmin()", () => {
    const code = withoutComments(
      readFileSync(join(PROTECTED_DIR, "layout.tsx"), "utf8")
    );

    expect(code).toMatch(/\bawait\s+requireAdmin\s*\(\s*\)/);
  });
});

describe("admin server actions authorise themselves", () => {
  /**
   * A Server Action is a public POST endpoint reachable by its id from the
   * client bundle, so `(protected)/` does not cover it. `signOut` is the
   * documented exception: requiring a session to END one strands anyone whose
   * token just expired.
   */
  const UNGUARDED_BY_DESIGN = new Set(["signOut", "requestLoginLink"]);

  it("guards every exported action except the documented exceptions", () => {
    const source = readFileSync(ACTIONS_FILE, "utf8");
    const code = withoutComments(source);

    const exported = [
      ...code.matchAll(/export\s+async\s+function\s+(\w+)/g),
    ].map((m) => m[1]);

    expect(exported.length).toBeGreaterThan(0);

    for (const action of exported) {
      if (UNGUARDED_BY_DESIGN.has(action)) continue;

      // Body of this action, up to the next export.
      const start = code.indexOf(`export async function ${action}`);
      const next = code.indexOf("export async function ", start + 1);
      const body = code.slice(start, next === -1 ? undefined : next);

      expect(
        /\bawait\s+requireAdmin\s*\(\s*\)/.test(body),
        `Server Action "${action}" does not call requireAdmin(). Either guard it, or add it to UNGUARDED_BY_DESIGN with the reason in a comment.`
      ).toBe(true);
    }
  });
});
