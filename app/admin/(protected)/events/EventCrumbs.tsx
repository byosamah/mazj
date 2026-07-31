import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Admin / Events / this one. The trail on both detail routes.
 *
 * 🔴 `asChild` wrapping `next/link`, never the locale-aware Link from the i18n
 * helpers. That one prepends `/en` or `/ar`, and `/en/admin` does not exist
 * because `proxy.ts` keeps admin out of next-intl's matcher, so every crumb
 * would 404. (Naming that import path here would also trip the enforcement grep
 * that asserts zero of them across this tree.)
 *
 * Shared by `new/page.tsx` and `[id]/page.tsx` rather than written twice: the
 * two trails differ only in their last word, and two copies is how one of them
 * ends up pointing at a route that has moved.
 */
export function EventCrumbs({current}: {current: string}) {
  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin">Admin</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin/events">Events</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
