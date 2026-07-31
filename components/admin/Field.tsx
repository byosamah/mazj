import { cn } from "@/lib/utils";

type FieldProps = {
  id: string;
  name: string;
  label: string;
  as?: "input" | "textarea" | "select";
  type?: string;
  rows?: number;
  hint?: string;
  error?: string;
  /** Renders ONE marker, and its words say what it means: a draft saves fine without it. */
  required?: boolean;
  dir?: "ltr" | "rtl";
  lang?: string;
  defaultValue?: string;
  /** The <option>s, when as="select". */
  children?: React.ReactNode;
} & Record<string, unknown>;

/**
 * The chevron on a native <select>.
 *
 * It is an inline style rather than a Tailwind arbitrary background-image
 * value because a data URI carries characters Tailwind's class parser cannot
 * hold: `#` has to become `%23`, and the quotes around the SVG attributes
 * cannot survive a class name. A style attribute takes the string verbatim.
 *
 * 🔴 Do NOT name that utility in full here, not even as prose. `components/**`
 * is a Tailwind CONTENT glob and the JIT scans raw text, so it cannot tell a
 * comment from markup: spelling the arbitrary value out compiles a real rule
 * into `globals.css` whose URL Turbopack then resolves as a MODULE, it fails,
 * and every route on the site answers 500. The error cites `app/globals.css`
 * and a line number in generated CSS, so it reads as a stylesheet defect a long
 * way from here. Cost an app-wide dev outage on 2026-07-29.
 *
 * The stroke is `#514E4A`, the subtle-foreground grey, so the chevron matches
 * the hint text rather than competing with the value.
 */
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23514E4A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")";

/**
 * Shared by all three controls.
 *
 * `bg-transparent`, never a white fill. The three white surfaces in the old
 * admin (one flat, two at 50% and 60%) are removed: pure white is reserved on
 * this brand for floating overlays, and the admin's only floating overlay is
 * the OS select popover.
 *
 * The NEGATIVE focus offset is DESIGN.md's rule for tightly padded containers,
 * so the ring draws inside the control instead of clipping against whatever sits
 * 1px away.
 *
 * `aria-invalid:border-2 aria-invalid:border-destructive` compiles ONLY because
 * of the `aria: { invalid: … }` entry in `tailwind.config.ts`. Tailwind 3 ships
 * a fixed aria-variant list without `invalid`, so without that line an invalid
 * field looks exactly like a valid one, which is invisible precisely when it
 * matters.
 */
const CONTROL =
  "w-full rounded border border-input bg-transparent px-3.5 text-15 placeholder:text-subtle-foreground focus-visible:outline-offset-[-2px] aria-invalid:border-2 aria-invalid:border-destructive";

/**
 * One form row: label, control, hint, error. The error sits INLINE, beside the
 * field it refers to, not in a summary at the top of the form.
 *
 * 🔴 A NATIVE <label>, not `components/ui/label.tsx`. That file's line 1 is the
 * client directive and it wraps Radix's Label, so importing it would make every
 * Field, and therefore every screen carrying a form, a client component.
 * Verified on disk.
 *
 * 🔴 `as="select"` renders a NATIVE <select>, never Radix's. Radix Select posts
 * NOTHING without a `name`, and the events form submits into a plain
 * `<form action={serverAction}>`, so swapping it in silently stops the ticket
 * price being submitted. A native select also handles Arabic option text, the
 * mobile picker and `dir` better, and ships no JavaScript.
 *
 * `required` renders ONE marker whose words say what it means. It replaces two
 * competing markers that did not agree (a coral word on Title, a coral asterisk
 * on Starts/Ends) plus the field that genuinely blocks publishing and carried
 * neither (Summary).
 */
export function Field({
  id,
  name,
  label,
  as = "input",
  type = "text",
  rows,
  hint,
  error,
  required = false,
  dir,
  lang,
  defaultValue,
  children,
  ...rest
}: FieldProps) {
  const describedBy =
    cn(hint && `${id}-hint`, error && `${id}-error`) || undefined;

  const shared = {
    id,
    name,
    dir,
    lang,
    defaultValue,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": describedBy,
    // Callers pass through anything the underlying element accepts
    // (placeholder, maxLength, step, accept…). The cast is needed because an
    // index signature cannot be spread onto a JSX intrinsic; the props it
    // carries are still checked by the element itself at the call site.
    ...(rest as React.HTMLAttributes<HTMLElement>),
  };

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-13 font-medium">
        {label}
        {required && (
          <span className="eyebrow text-10 text-warn">required to publish</span>
        )}
      </label>

      {as === "textarea" ? (
        <textarea {...shared} rows={rows} className={cn(CONTROL, "min-h-24 py-2.5")} />
      ) : as === "select" ? (
        <select
          {...shared}
          style={{ backgroundImage: SELECT_CHEVRON }}
          className={cn(
            CONTROL,
            "h-11 appearance-none bg-no-repeat bg-[position:right_12px_center]"
          )}
        >
          {children}
        </select>
      ) : (
        <input {...shared} type={type} className={cn(CONTROL, "h-11")} />
      )}

      {hint && (
        <p id={`${id}-hint`} className="text-12 leading-[1.5] text-subtle-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-13 text-destructive"
        >
          <span aria-hidden className="mt-1 size-2 shrink-0 rounded-sm bg-destructive" />
          {error}
        </p>
      )}
    </div>
  );
}
