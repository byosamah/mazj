import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

type SectionProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Default true. False on the first section after PageHead, whose own rule is directly above. */
  ruled?: boolean;
  children: React.ReactNode;
};

/**
 * The admin's content block.
 *
 * The rhythm is fixed and it is the whole system: hairline → 20px → eyebrow →
 * 8px → heading → 20px → content. DESIGN.md: "Every content block starts on a
 * 1px hairline with the eyebrow sitting 20px below it. This rule, not a border
 * or a shadow, is what groups content."
 *
 * Parents stack sections with `space-y-10 lg:space-y-12`.
 */
export function Section({
  eyebrow,
  title,
  subtitle,
  action,
  ruled = true,
  children,
}: SectionProps) {
  return (
    <section className={cn(ruled && "border-t border-border", "pt-5")}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-2 text-20 font-medium tracking-[-0.02em]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-13 text-subtle-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
