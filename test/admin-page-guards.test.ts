import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

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
 *
 * ---
 *
 * The second half of this file defends the DESIGN system rather than the
 * authorisation, and it lives here for the same reason: both are properties of
 * the files, and both erode one hurried line at a time. The admin ships a closed
 * type scale, a closed colour set and a fixed radius ladder; every one of those
 * is a Tailwind class name that produces NOTHING when it falls outside the set,
 * so a violation renders as plausible 16px text rather than as an error anyone
 * would notice. The first erosion is already recorded: a 30px `text-3xl` metric.
 */

const PROTECTED_DIR = join(process.cwd(), "app", "admin", "(protected)");
const LIB_DIR = join(process.cwd(), "app", "admin", "_lib");
const ADMIN_DIR = join(process.cwd(), "app", "admin");
const ADMIN_COMPONENTS_DIR = join(process.cwd(), "components", "admin");

/**
 * Files of a given name at any depth under a directory.
 *
 * 🔴 The name match is EXACT, and that is not incidental. `(protected)/` also
 * holds route boundaries (`loading.tsx`, `error.tsx`, `not-found.tsx`) and two
 * client components (`Sidebar.tsx`, `EventForm.tsx`). None of them reads MAZJ
 * data and none of them can call `requireAdmin()`: a boundary renders a skeleton
 * or a fixed sentence, and `error.tsx` carries `"use client"`, where the guard
 * does not exist. Widening this to a `*.tsx` glob would fail all eight of them,
 * and the fix someone would then reach for is loosening the assertion, which
 * ends with the whole suite passing on a page that reads the dashboard.
 * `guardedFileNamesAreExact` below pins the property so it fails here instead.
 */
function filesNamed(name: string, dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesNamed(name, path, found);
    else if (entry.name === name) found.push(path);
  }
  return found;
}

/**
 * Every `"use server"` module in `_lib/`.
 *
 * 🔴 Discovered rather than listed. This test named ONE file until 2026-07-28,
 * when `event-actions.ts` was added beside it: the new module's actions publish
 * to the live site and delete registrations, and the suite would have gone on
 * passing while checking the other file. A guard test with a hardcoded path
 * silently stops covering the thing it was written for the first time somebody
 * adds a second file.
 */
function actionModules(): string[] {
  return readdirSync(LIB_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => join(LIB_DIR, e.name))
    .filter((path) => /^\s*["']use server["']/.test(readFileSync(path, "utf8")));
}

/** Same text, same length, same line breaks, no content. */
function blankOut(match: string): string {
  return match.replace(/[^\n]/g, " ");
}

/**
 * Blanks comments before searching, in both directions.
 *
 * Reading a CALL, without this the test passes on a file that only MENTIONS
 * `requireAdmin()` in a comment, which is the exact shape of a page whose author
 * explained the guard and then forgot to write it. This repo's own CLAUDE.md
 * records the same trap in a different form: `grep -c "<img"` counted JSDoc
 * prose as elements.
 *
 * Reading a CLASS, the error runs the other way: the style rules below assert
 * that a string is ABSENT, so a banned class named in a comment that explains
 * why it is banned would fail a file that is in fact correct.
 *
 * 🔴 Two details are load-bearing.
 *
 * Comments are blanked, not deleted, so every byte offset and line number stays
 * exactly where it is in the real file. The guard tests compare the INDEX of
 * `requireAdmin()` against the index of the first data read, and deleting text
 * above them would move both; the failure messages below quote a line number
 * that has to survive a `grep -n` on the file itself.
 *
 * And `//` is only treated as a comment when the character before it is not a
 * colon. `href="https://mazj.sa/…"` would otherwise blank the remainder of that
 * line, which can swallow a real violation, or a real `requireAdmin()`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blankOut)
    .replace(/(^|[^:])\/\/[^\n]*/gm, (match, lead: string) =>
      lead === "" ? blankOut(match) : lead + blankOut(match.slice(lead.length))
    );
}

describe("admin pages authorise themselves", () => {
  const pages = filesNamed("page.tsx", PROTECTED_DIR);

  it("finds pages to check at all", () => {
    // A rename of the route group would otherwise make this whole suite pass by
    // checking nothing, which is worse than failing.
    expect(pages.length).toBeGreaterThan(0);
  });

  it("only ever discovers files actually named page.tsx", () => {
    // The route boundaries added alongside the redesign sit in these same
    // folders and read nothing, so sweeping them in would fail eight correct
    // files. See the note on filesNamed().
    expect(pages.map((p) => basename(p))).toEqual(pages.map(() => "page.tsx"));
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

describe("admin route handlers authorise themselves", () => {
  /**
   * 🔴 A route handler under `(protected)/` is NOT protected by that layout.
   *
   * Layouts wrap pages. A `route.ts` is reached directly and no layout runs for
   * it at all, so for these files `requireAdmin()` is not a second line of
   * defence, it is the only one. The registrations CSV is the live example: an
   * unguarded GET would hand anybody a spreadsheet of names, mobile numbers and
   * email addresses collected from a public form.
   *
   * The folder name is exactly what makes this easy to get wrong.
   */
  const handlers = filesNamed("route.ts", PROTECTED_DIR);

  it("only ever discovers files actually named route.ts", () => {
    expect(handlers.map((h) => basename(h))).toEqual(
      handlers.map(() => "route.ts")
    );
  });

  it.each(handlers)("%s calls requireAdmin() above any data read", (handler) => {
    const code = withoutComments(readFileSync(handler, "utf8"));

    const guard = code.search(/\bawait\s+requireAdmin\s*\(\s*\)/);
    expect(
      guard,
      "a route handler under (protected)/ gets no layout guard at all"
    ).toBeGreaterThan(-1);

    const load = code.search(/\bawait\s+load[A-Z]\w*\s*\(/);
    if (load > -1) expect(guard).toBeLessThan(load);
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

  const modules = actionModules();

  it("finds every 'use server' module in _lib", () => {
    // Guards the discovery itself. If the scan returned nothing, every
    // assertion below would vacuously pass while the actions went unchecked.
    expect(modules.length).toBeGreaterThan(0);
  });

  it.each(modules)(
    "%s guards every exported action except the documented exceptions",
    (file) => {
      const code = withoutComments(readFileSync(file, "utf8"));

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
    }
  );
});

/* ========================================================================== *
 * The admin's closed design system.
 * ========================================================================== */

type AdminSource = { rel: string; code: string };

/**
 * Every `.ts`/`.tsx` file the admin owns.
 *
 * Scope is `app/admin/**` plus `components/admin/**`, and 🔴 `components/ui/**`
 * is deliberately outside it: those eleven files are generated by
 * `scripts/vendor-shadcn.py` from the shadcn registry, so a rule broken there is
 * fixed in the script, not in the file, and asserting on them would make the
 * next re-vendor fail this test for something no author here typed.
 *
 * `.css` is out of scope too. Every rule below is a Tailwind CLASS NAME, which
 * can only appear in TS or TSX; `admin.css` is plain CSS declarations and is
 * owned outright by §3 of the spec.
 *
 * Discovered, never listed, for the same reason the pages above are.
 */
function adminSources(): AdminSource[] {
  const found: AdminSource[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name))
        found.push({
          rel: relative(process.cwd(), path).split(sep).join("/"),
          code: withoutComments(readFileSync(path, "utf8")),
        });
    }
  };

  walk(ADMIN_DIR);
  walk(ADMIN_COMPONENTS_DIR);
  return found;
}

const SOURCES = adminSources();

/** `path:line  the offending text`, so a failure is directly greppable. */
function locate(source: AdminSource, pattern: RegExp): string[] {
  const scan = new RegExp(pattern.source, "g");
  const out: string[] = [];

  for (const match of source.code.matchAll(scan)) {
    const line = source.code.slice(0, match.index).split("\n").length;
    out.push(`${source.rel}:${line}  ${match[0]}`);
  }
  return out;
}

function report(offenders: string[]): string {
  const shown = offenders.slice(0, 15).join("\n  ");
  const rest = offenders.length - 15;
  return `  ${shown}${rest > 0 ? `\n  … and ${rest} more` : ""}`;
}

type StyleRule = {
  /** Reads as the test name, so it states the rule and not the regex. */
  title: string;
  pattern: RegExp;
  /** Files where the pattern is legitimate, by repo-relative path. */
  allow?: string[];
  /** Whole directory where it is legitimate, by repo-relative prefix. */
  allowUnder?: string;
  /** What breaks if this ships. Printed on failure, above the offenders. */
  why: string;
};

/**
 * 🔴 Every rule here describes a defect that WAS shipping, with its measured
 * count at the time the redesign started. They are absent-string assertions, so
 * they cannot be satisfied by a comment: `withoutComments` blanks those first,
 * in the direction that protects the file rather than the test.
 */
const STYLE_RULES: StyleRule[] = [
  {
    title: "uses the closed numeric type scale, never Tailwind's t-shirt sizes",
    // `text-2xl` does not match `text-xl`: the alternation runs after `text-`,
    // where the next character is "2". Nothing here can reach `rounded-2xl`.
    pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b/,
    why:
      "The admin's type scale is the closed set 8..85 as text-<n>, and it is closed " +
      "because the two systems disagree silently: text-3xl is 30px, a size the ramp " +
      "does not contain, and it is how a 30px metric got onto the dashboard. " +
      "Baseline when the redesign started: 133 across six sizes.",
  },
  {
    title: "never asks for a weight the typeface does not carry",
    pattern: /\bfont-semibold\b/,
    why:
      "Thmanyah ships 400/500/700/900. There is no 600, so font-semibold is resolved " +
      "UP to 700 by CSS font matching: the rendered weight is one nobody chose, and it " +
      "differs from font-bold nowhere while reading as a deliberate distinction in the " +
      "source. Baseline: 17.",
  },
  {
    title: "never sets font-mono",
    pattern: /\bfont-mono\b/,
    why:
      "There is no mono face in this project. --font-mono resolves to Thmanyah Sans, " +
      "so the class is a no-op that reads as an intentional register change. All 45 of " +
      "them were deleted from the marketing site for exactly this reason. Numeric " +
      "alignment comes from tabular-nums, which is real. Baseline: 13.",
  },
  {
    title: "never tints with the marketing black token",
    pattern: /\btext-black\//,
    why:
      "text-black/60 is the marketing site's ink over ITS surfaces. The admin's ink is " +
      "`foreground` and its secondary is `subtle-foreground` (#514E4A), both measured " +
      "against cream, beige-1 and tan. An arbitrary alpha of black is an unmeasured " +
      "contrast ratio wearing the look of a considered one. Baseline: 110.",
  },
  {
    title: "keeps to the crisp radius ladder",
    pattern: /\brounded-(?:md|lg|xl)\b/,
    why:
      "The shape language is 2 / 4 / 16 (rounded-sm, rounded, rounded-2xl). The 6px and " +
      "8px rungs are bootstrap's, not this system's, and they are what makes a panel " +
      "read as a generic card. Baseline 36 (13 lg + 23 xl), measured 2026-07-29; §8.6 " +
      "of the spec records 20, from a narrower scope. rounded-2xl is untouched by this " +
      "pattern and there were none.",
  },
  {
    title: "keeps the pill shape inside StatusDot",
    pattern: /\brounded-full\b/,
    allow: ["components/admin/StatusDot.tsx"],
    why:
      "A full radius is the dot's own signature and it carries meaning: hue alone " +
      "separates ok / warn / destructive at 1.01:1, so SHAPE is one of the three " +
      "signals a status must carry. Spending the shape on ordinary chrome spends the " +
      "signal. Baseline 20 outside StatusDot, measured 2026-07-29; §8.6 of the spec " +
      "records 14, from a narrower scope.",
  },
  {
    title: "never paints white",
    pattern: /\b(?:bg|text)-white\b/,
    why:
      "The admin's surfaces are cream, beige-1 and tan, all measured. A white card on " +
      "cream is the exact string the marketing site banned (`bg-white rounded-[16px] " +
      "shadow-…`) because it is what made sub-pages read as a generic card grid. " +
      "Baseline: 16.",
  },
  {
    title: "never writes the marketing `muted` token",
    // Also catches text-muted-foreground, which is the shape the shadcn registry
    // ships and therefore the one most likely to be pasted in.
    pattern: /\b(?:bg|text)-muted\b/,
    why:
      "🔴 `muted` is TAKEN: it is the marketing site's #514E4A, used 69 times there. " +
      "shadcn's muted / muted-foreground pair is vendored here under the names subtle / " +
      "subtle-foreground, and scripts/vendor-shadcn.py rewrites every registry " +
      "occurrence on the way in. bg-muted resolves to a solid #514E4A block.",
  },
  {
    title: "keeps the status hues inside the primitives that carry a word too",
    pattern: /\b(?:bg|text)-(?:ok|warn|destructive)\b/,
    // Every primitive may reach for them; no surface may.
    allowUnder: "components/admin/",
    why:
      "ok / warn / destructive are separated by HUE ALONE (ok vs warn 1.01:1). In " +
      "greyscale, on a projector, or to a reader with monochromacy they are the same " +
      "pixel. Every status therefore carries hue, SHAPE and a WORD, which the Chip / " +
      "StatusDot / Notice props enforce and a raw class does not. Reach for the " +
      "primitive; if none fits, the missing thing is a primitive.",
  },
];

describe("the admin's closed design system stays closed", () => {
  it("finds admin source to scan at all", () => {
    // Without this every absent-string assertion below passes vacuously, which
    // is the failure mode of a negative test: it looks green while checking
    // nothing. Both roots must be present, not just one.
    expect(SOURCES.length).toBeGreaterThan(0);
    expect(SOURCES.some((s) => s.rel.startsWith("app/admin/"))).toBe(true);
    expect(SOURCES.some((s) => s.rel.startsWith("components/admin/"))).toBe(
      true
    );
  });

  for (const rule of STYLE_RULES) {
    it(rule.title, () => {
      const offenders = SOURCES.filter(
        (s) =>
          !rule.allow?.includes(s.rel) &&
          !(rule.allowUnder && s.rel.startsWith(rule.allowUnder))
      ).flatMap((s) => locate(s, rule.pattern));

      expect(offenders, `${rule.why}\n\n${report(offenders)}\n`).toEqual([]);
    });
  }

  /**
   * The coral is the one marketing token the admin keeps, and it is kept on a
   * budget rather than banned: it is MAZJ's, it may never be darkened, and it
   * may never say anything (a status is ok / warn / destructive, all measured;
   * coral on tan is 2.47:1 and means "brand", not "wrong").
   *
   * So it survives in two files, as identity, in three places and two spellings:
   * the rail's مزج mask fill (`Sidebar.tsx`, `#FF5A48`), the rail's index
   * numerals (`Sidebar.tsx`, the `orange` token, twice on one line), and the
   * login screen's مزج mask fill (`login/page.tsx`, `#FF5A48`). Four matched
   * tokens. The moment it appears anywhere else it has started to mean
   * something.
   *
   * 🔴 THE PATTERN MUST MATCH BOTH SPELLINGS, AND THIS IS NOT PEDANTRY. It read
   * `/\borange\b/` until 2026-07-29, which sees the Tailwind token and is blind
   * to the hex literal the two mask fills actually use. Measured consequences:
   * it counted 2 of the 4 real uses, `login/page.tsx` contributed ZERO matches
   * to a test that names it as a coral home, and its budget of 4 therefore
   * carried 2 units of slack nobody knew about. It was demonstrated, not
   * theorised: a scratch file under `components/admin/` carrying
   * `bg-[#FF5A48]` AND a DARKENED `#E04A38` passed both assertions green.
   * Darkening the coral is the one thing about it the owner has refused twice.
   *
   * ⚠️ Case is spelled out rather than flagged, because `locate()` rebuilds the
   * pattern as `new RegExp(pattern.source, "g")` and DISCARDS every flag. An
   * `/i` here compiles, reads correctly, and silently matches nothing.
   */
  describe("the coral stays identity, never information", () => {
    const CORAL_HOMES = [
      "app/admin/(protected)/Sidebar.tsx",
      "app/admin/login/page.tsx",
    ];
    const CORAL = /\borange\b|#[Ff][Ff]5[Aa]48/;

    it("appears in no file but the rail and the login screen", () => {
      const offenders = SOURCES.filter(
        (s) => !CORAL_HOMES.includes(s.rel)
      ).flatMap((s) => locate(s, CORAL));

      expect(
        offenders,
        "The coral #FF5A48 is brand identity. Used as a hue on a control, a chip or a " +
          "row it becomes a status the palette never defined, and the reader has to " +
          "guess which. Baseline when the redesign started: 48 uses.\n\n" +
          report(offenders)
      ).toEqual([]);
    });

    it("is spent at most four times", () => {
      const uses = SOURCES.flatMap((s) => locate(s, CORAL));

      expect(
        uses.length,
        `A budget, not a ban. Expected at most 4 uses of the coral token.\n\n${report(uses)}`
      ).toBeLessThanOrEqual(4);
    });

    /**
     * 🔴 THE RULE ABOVE CANNOT, BY CONSTRUCTION, CATCH THE REGRESSION THAT
     * ACTUALLY MATTERS.
     *
     * "Never darkened, never substituted" is the owner's standing ruling on
     * `#FF5A48`, twice given and twice acted on. A grep for the word `orange`
     * or for the exact string `#FF5A48` cannot express it: a darkened coral is
     * by definition a DIFFERENT literal, so `#E04A38` sails through both
     * assertions above while being precisely the change that was refused.
     *
     * The only thing a static check can enforce here is the property that makes
     * darkening possible in the first place: a raw hex in admin source. Every
     * colour the admin needs already exists as a token resolving through
     * `app/admin/admin.css`, so a 6-digit hex in a `.tsx` file means somebody
     * has stepped outside the palette, and the palette is the whole reason the
     * contrast figures in that file are true.
     *
     * The two `WORDMARK` mask fills are the sanctioned exception, and they have
     * to be: a CSS `mask-image` composites against `background-color`, which
     * takes a real colour value and cannot read a Tailwind class.
     */
    it("uses no raw hex outside the two wordmark fills", () => {
      const RAW_HEX = /#[0-9a-fA-F]{6}\b/;
      const offenders = SOURCES.filter(
        (s) => !CORAL_HOMES.includes(s.rel)
      ).flatMap((s) => locate(s, RAW_HEX));

      expect(
        offenders,
        "A raw hex in admin source is how the coral gets darkened without this " +
          "suite noticing, and how a colour outside the measured palette gets in. " +
          "Every admin colour has a token in app/admin/admin.css; reach for it. " +
          "The only sanctioned raw values are the two مزج mask fills, which need " +
          "a real background-color because a CSS mask cannot read a class.\n\n" +
          report(offenders)
      ).toEqual([]);
    });
  });

  /**
   * One h1 per route, and PageHead is where it lives.
   *
   * Counting `<h1` alone would pass the whole surface the moment PageHead lands,
   * since a page then contains no literal h1 at all and a page that forgot its
   * head would look identical to one that has it. So the assertion counts
   * HEADING SOURCES: a literal h1, or the component that renders exactly one.
   * Two of either is two h1s in the document, which is what breaks a screen
   * reader's outline; zero is a page with no name.
   */
  it("gives every protected page exactly one h1", () => {
    const pages = filesNamed("page.tsx", PROTECTED_DIR);
    expect(pages.length).toBeGreaterThan(0);

    const counted = pages.map((page) => {
      const rel = relative(process.cwd(), page).split(sep).join("/");
      const code = withoutComments(readFileSync(page, "utf8"));
      const heads = [...code.matchAll(/<h1\b|<PageHead\b/g)].length;
      return `${rel}: ${heads}`;
    });

    expect(
      counted,
      "Each page needs exactly one heading source: a <PageHead> (which renders the h1) " +
        "or, outside the system, one literal <h1>."
    ).toEqual(counted.map((entry) => entry.replace(/: \d+$/, ": 1")));
  });

  /**
   * The icon vocabulary is capped, and the cap is on DISTINCT icons rather than
   * on import statements: what costs a reader is the number of different marks
   * they have to learn, not how many files reach for the same chevron.
   *
   * A small set also keeps the icons meaningful. Six is enough for a disclosure
   * chevron, an external-link glyph and the handful of controls that genuinely
   * cannot be a word, and not enough to start decorating headings.
   */
  it("draws on at most six distinct lucide icons", () => {
    const named = new Set<string>();
    const namespaced: string[] = [];

    for (const source of SOURCES) {
      for (const match of source.code.matchAll(
        /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g
      )) {
        for (const specifier of match[1].split(",")) {
          const name = specifier.trim().split(/\s+as\s+/)[0].trim();
          if (name) named.add(name);
        }
      }

      // `import * as Icons` would make the cap unmeasurable rather than break
      // it, so it fails on its own terms.
      namespaced.push(
        ...locate(source, /import\s*\*\s*as\s+\w+\s*from\s*["']lucide-react["']/)
      );
    }

    expect(
      namespaced,
      "A namespace import puts every lucide glyph one keystroke away and makes the " +
        `budget unmeasurable rather than merely exceeded.\n\n${report(namespaced)}`
    ).toEqual([]);

    const vocabulary = [...named].sort();
    expect(
      vocabulary.length,
      `Currently imported: ${vocabulary.join(", ")}.\n\n` +
        "§4.7 of the spec allocates exactly six, all of them monochrome, all beside a " +
        "text label: LayoutDashboard, CalendarDays, Rocket (the nav), ChevronRight " +
        "(breadcrumb), ChevronDown (Disclosure), ExternalLink (the public event URLs). " +
        "A seventh is a new decision, not a default, and it needs an entry in that " +
        "section before it needs a line here."
    ).toBeLessThanOrEqual(6);
  });

  /**
   * The client boundary, pinned as a NAMED SET rather than as a count.
   *
   * `components/admin/index.ts` stated the number in prose and it drifted: it
   * said five when six files carry the directive. A count written into a comment
   * is a fact with no owner, so the set is asserted here and the comment points
   * at this test instead of restating it.
   *
   * 🔴 Listed rather than discovered, which is the opposite of every other scan
   * in this file and is deliberate. The property is a BUDGET, like the six
   * lucide glyphs above: discovery would report whatever is there and pass
   * forever. A seventh client component ships more JavaScript to a tool three
   * people use, and it is the door a drawer or a command palette walks through,
   * so it should cost an edit here.
   *
   * The two `error.tsx` entries are not a choice. Next requires `"use client"`
   * on every error boundary, which is also why `filesNamed` above matches page
   * and route names EXACTLY rather than by glob.
   */
  it("ships exactly six client components, all of them under app/admin", () => {
    const EXPECTED = [
      "app/admin/(protected)/Sidebar.tsx",
      "app/admin/(protected)/error.tsx",
      "app/admin/(protected)/events/EventForm.tsx",
      "app/admin/(protected)/startups/[id]/DecisionForms.tsx",
      "app/admin/error.tsx",
      "app/admin/login/LoginForm.tsx",
    ];

    // Anchored at the START of the file, the only place Next honours a
    // directive. `withoutComments` blanks a comment to spaces rather than
    // deleting it, so `\s*` still reaches a directive sitting under a header.
    const found = SOURCES.filter((s) => /^\s*["']use client["']/.test(s.code))
      .map((s) => s.rel)
      .sort();

    expect(
      found,
      "Every primitive in components/admin is a server component, and that is the half " +
        "of this rule with teeth: anything reachable from a client component ships to " +
        "the browser, and app/admin/_lib is a sanctioned crossing into @/server that can " +
        "reach the Supabase secret key and the admin-scope Rekaz credential. Adding a " +
        "seventh is a decision. Record it here and in components/admin/index.ts."
    ).toEqual([...EXPECTED].sort());
  });
});

/* ========================================================================== *
 * One forbidden string, in one file.
 * ========================================================================== */

/**
 * Four primitives each ban ONE string from their OWN file, where the same string
 * is ordinary code everywhere else in the admin.
 *
 * 🔴 These exist because they did NOT exist while four docblocks said they did.
 * Until 2026-07-29 `EmptyState`, `RevealedSecret`, `(protected)/error.tsx` and
 * `Sidebar` each carried a sentence naming this file as the thing enforcing its
 * rule, and not one of the four assertions had been written. That is worse than
 * saying nothing: a reviewer who reads "a test covers this" stops looking, so
 * every rule was guarded only by the sentence claiming it was guarded. Three of
 * them went further and told the next author not to reword the file.
 *
 * They cannot be `STYLE_RULES` entries. That table asserts a string is absent
 * from EVERY admin source bar an allow list, which is the inverse shape: `tone`,
 * an anchor tag, `error.message` and `useState` are all correct in other admin
 * files, and `allow` excludes files rather than selecting one.
 *
 * 🔴 Each scans the COMMENT-STRIPPED copy, exactly like the rules above, and
 * that is the point rather than a shortcut. `withoutComments` exists so a file
 * may explain the shape it forbids without failing for naming it (see its own
 * docblock, which argues this direction in writing). A raw comment-inclusive
 * scan buys nothing a reader can use, because what reaches a browser is the
 * code, and it costs real prose: `EmptyState`'s docblock refused to name `tone`
 * at all and forbade anyone from fixing that, for an enforcement that was not
 * there. All four docblocks now name what they ban.
 */
type FileRule = {
  /** Reads as the test name, so it states the rule and not the regex. */
  title: string;
  /** Repo-relative, matching `AdminSource.rel`. */
  file: string;
  pattern: RegExp;
  /** What breaks if this ships. Printed on failure, above the offenders. */
  why: string;
};

const FILE_RULES: FileRule[] = [
  {
    title: "EmptyState declares no tone, in any spelling",
    file: "components/admin/EmptyState.tsx",
    pattern: /\btone\b/,
    why:
      "A failed load and an empty result must render as DIFFERENT OBJECTS, and what turns " +
      "that from a convention somebody remembers into a TypeScript error is that " +
      "EmptyState has no colour register to pass. One `tone` prop collapses 'nothing " +
      "happened' and 'we could not find out' back into the same pixels, which is the " +
      "single defect the whole redesign exists to remove.",
  },
  {
    title: "RevealedSecret contains no anchor element",
    file: "components/admin/RevealedSecret.tsx",
    pattern: /<a\b/,
    why:
      "A checkout link is a bearer capability: one click from the front desk lands a MAZJ " +
      "colleague on a stranger's payment page, and there is no undo for what happens " +
      "next. The URL is selectable text on purpose, so this component has no href prop " +
      "and no anchor anywhere in its tree. The word boundary means `<article` and any " +
      "capitalised component are not matches; the open tag itself is.",
  },
  {
    title: "the protected error boundary never renders the thrown error's own text",
    file: "app/admin/(protected)/error.tsx",
    pattern: /\b(?:error|result)\.message\b/,
    why:
      "This is the one admin screen a stranger might reach if a guard ever fails, and an " +
      "uncaught error's text can carry a database hostname, a fragment of a query, a " +
      "Rekaz field name in Arabic, or the shape of a credential. Only `digest`, an opaque " +
      "hash Next generates for the purpose, may cross to the browser.\n\n" +
      "🔴 Scoped to this ONE file rather than to app/admin, and the narrowing is measured " +
      "rather than cautious: the tree-wide pattern also matches " +
      "app/admin/(protected)/startups/page.tsx:115, where `QueueFailure.message` is a " +
      "sentence authored for a human in _lib/startups.ts and is exactly what should be " +
      "on screen. A tree-wide rule here would be red today for a correct file.",
  },
  {
    title: "Sidebar holds no state",
    file: "app/admin/(protected)/Sidebar.tsx",
    pattern: /\buseState\b|\buseReducer\b/,
    why:
      "The admin is responsive without JavaScript: no drawer, no collapse toggle, no " +
      "persisted open state, no command palette (owner ruling). Responsive behaviour is " +
      "three class lists on one markup tree, so there is nothing that can jam open, jam " +
      "shut, or disagree with the URL. `\"use client\"` is here for `usePathname` and " +
      "`useLinkStatus` alone. The next person who wants a collapsible rail reaches for " +
      "`useState` first, which is the whole reason this is a test and not a note.",
  },
];

describe("four primitives each ban one string from their own file", () => {
  for (const rule of FILE_RULES) {
    it(rule.title, () => {
      const source = SOURCES.find((s) => s.rel === rule.file);

      // A rename or a move would otherwise make the assertion pass by scanning
      // nothing, which is the failure mode that produced these four in the first
      // place: a rule everybody believed was checked.
      expect(
        source,
        `${rule.file} is not in the admin source scan. If it moved, move this rule.`
      ).toBeDefined();

      const offenders = source ? locate(source, rule.pattern) : [];
      expect(offenders, `${rule.why}\n\n${report(offenders)}\n`).toEqual([]);
    });
  }
});
