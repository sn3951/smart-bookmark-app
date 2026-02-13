import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";
import AuthListener from "@/components/AuthListener";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* AuthListener handles cross-tab login/logout */}
      <AuthListener />

      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-accent rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="font-bold text-lg tracking-tight">Markd</span>
        </div>
        <div className="font-mono text-xs text-muted uppercase tracking-widest">
          Bookmark Manager
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full">
          <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 bg-surface border border-border rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot"></div>
            <span className="font-mono text-xs text-muted uppercase tracking-widest">
              Real-time sync across tabs
            </span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight leading-none mb-6">
            Your links,
            <br />
            <span className="text-accent">always there.</span>
          </h1>

          <p className="text-lg text-muted font-normal leading-relaxed mb-12 max-w-lg">
            Save bookmarks in seconds. They stay private, sync in real-time, and
            live wherever you sign in with Google.
          </p>

          <LoginButton />

          <div className="flex flex-wrap gap-3 mt-10">
            {[
              "🔒 Private by default",
              "⚡ Real-time sync",
              "🗑️ Delete anytime",
              "🌐 Google OAuth",
            ].map((feat) => (
              <span
                key={feat}
                className="px-3 py-1.5 bg-surface border border-border rounded-full font-mono text-xs text-muted"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          Built with Next.js · Supabase · Tailwind
        </span>
        <span className="font-mono text-xs text-muted">v1.0.0</span>
      </div>
    </main>
  );
}