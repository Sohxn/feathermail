/**
 * Landing Page
 * Marketing page with pricing
 * 
 * First page users see - convinces them to sign up
 */

import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground"></p>
          <h1 className="mt-2 text-xl font-semibold">FeatherMail</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/login")}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground/90 transition-colors hover:bg-secondary"
          >
            Log in
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-90"
          >
            Sign up
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16 pt-8 lg:pt-16">
        <section className="max-w-2xl">
          <p className="text-sm text-muted-foreground"></p>

          <h2 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
            A simple email workspace for you to focus on what matters.
          </h2>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            FeatherMail is an email client focused on reading, sorting, and replying without extra noise.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue to app
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Create account
            </button>
          </div>

          <div className="mt-10 rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Features</div>
            <ul className="divide-y divide-border">
              {[
                "Focused inbox view",
                "Read, sort, and reply quickly",
                "email summarization",
                "Smart categorization and organization",
                "Multiple account support",
                "Real-time sync and notifications",
              ].map((item) => (
                <li key={item} className="px-4 py-3 text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 rounded-lg border border-border bg-secondary/20 px-6 py-6">
            <h3 className="text-sm font-semibold text-foreground">Coming to mobile</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Native iOS and Android apps are in development. Access your FeatherMail account seamlessly across all your devices.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-sm text-muted-foreground">
        © 2026 FeatherMail
      </footer>
    </div>
  );
}