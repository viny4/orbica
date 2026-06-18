import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl || "/sync-logs";

  async function login(formData: FormData) {
    "use server";
    
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (username === validUsername && password === validPassword) {
      const cookieStore = await cookies();
      cookieStore.set("admin_token", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 1 day
      });
      redirect(searchParams.callbackUrl || "/sync-logs");
    } else {
      redirect("/login?error=Invalid credentials");
    }
  }

  return (
    <div className="min-h-screen bg-[#03050a] flex items-center justify-center p-6 text-white font-mono">
      <div className="w-full max-w-sm p-8 border border-white/10 bg-black/40 backdrop-blur">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8 text-center text-[var(--color-space-accent-2)]">
          System Access
        </h1>
        
        {searchParams.error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            {searchParams.error}
          </div>
        )}

        <form action={login} className="space-y-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          
          <div className="space-y-2">
            <label className="text-[10px] tracking-widest uppercase text-white/50 block">
              Operator ID
            </label>
            <input 
              name="username" 
              type="text" 
              required
              className="w-full bg-black/60 border border-white/10 p-3 text-sm focus:outline-none focus:border-[var(--color-space-accent-2)] transition-colors text-white"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] tracking-widest uppercase text-white/50 block">
              Passcode
            </label>
            <input 
              name="password" 
              type="password" 
              required
              className="w-full bg-black/60 border border-white/10 p-3 text-sm focus:outline-none focus:border-[var(--color-space-accent-2)] transition-colors text-white"
            />
          </div>
          
          <button 
            type="submit"
            className="w-full py-4 bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-white/90 transition-colors mt-8"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
