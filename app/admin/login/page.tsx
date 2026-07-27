import { redirect } from "next/navigation";

import { getAdminUser } from "../_lib/auth";
import LoginForm from "./LoginForm";

/**
 * The sign-in page.
 *
 * Sits OUTSIDE the `(protected)` route group, so it renders for anonymous
 * visitors. Inside the group, the guard would bounce an anonymous visitor here,
 * and rendering here would bounce them again.
 *
 * It does check for an EXISTING session, in the other direction: someone who is
 * already signed in and lands on the login page should go to the dashboard
 * rather than be asked to sign in again.
 */
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminUser()) redirect("/admin");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">MAZJ Admin</h1>
      <p className="mt-2 mb-8 text-sm text-black/50">
        Sign in with your MAZJ email. No password: we send you a link.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-orange/30 bg-orange/5 px-4 py-3 text-sm text-black/70"
        >
          {/* The callback route passes only a fixed token, never an upstream
              message, so nothing here can be set to arbitrary text by whoever
              crafted the URL. */}
          That sign-in link was invalid or had expired. Please request a new one.
        </p>
      )}

      <LoginForm />
    </main>
  );
}
