import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, credentialsMatch, safeCallback } from "@/lib/adminSession";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Operator sign-in — Orbica",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "Invalid credentials.",
  config: "Sign-in isn't configured on this deployment.",
};

export default function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  const callbackUrl = safeCallback(searchParams.callbackUrl);

  async function login(formData: FormData) {
    "use server";

    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    // Validate again on the server: the hidden field is user-controlled.
    const next = safeCallback(String(formData.get("callbackUrl") ?? ""));

    if (!(await credentialsMatch(username, password))) {
      // Small fixed delay blunts online guessing without a datastore.
      await new Promise((r) => setTimeout(r, 750));
      redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(next)}`);
    }
    const token = await createSession();
    if (!token) redirect("/login?error=config");

    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    // Drop the legacy, forgeable cookie if a browser still has it.
    cookies().delete("admin_token");
    redirect(next);
  }

  // Only known error codes are displayed — never reflect arbitrary query text.
  const error = searchParams.error ? ERRORS[searchParams.error] ?? ERRORS.invalid : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-void p-6 font-mono text-ink">
      <div className="w-full max-w-sm border border-line bg-black/40 p-8 backdrop-blur">
        <h1 className="mb-8 text-center text-xl font-light uppercase tracking-widest text-accent">System access</h1>

        {error && (
          <div role="alert" className="mb-6 border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger">
            {error}
          </div>
        )}

        <form action={login} className="space-y-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="space-y-2">
            <label htmlFor="username" className="block text-[10px] uppercase tracking-widest text-ink-3">
              Operator ID
            </label>
            <input id="username" name="username" type="text" autoComplete="username" required className="field w-full p-3" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-[10px] uppercase tracking-widest text-ink-3">
              Passcode
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="field w-full p-3" />
          </div>
          <button type="submit" className="btn btn-primary mt-8 w-full">
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
