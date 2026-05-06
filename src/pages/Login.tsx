import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink } from "lucide-react";
import { isDev } from "@/lib/devMode";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // for dev mode 
  // skips auth for UI changes
  useEffect(() => {
    if(isDev){
      navigate("/");
    }
  },[]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/landing" className="text-xl font-bold" style={{ fontFamily: "'Magnolia Script', cursive" }}>
            Feathermail
          </Link>
          
          {/* Top Right Buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <a
              href="https://github.com/sohxn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Login Form - Centered */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute -inset-x-10 -top-24 h-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 top-24 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
          </div>

          {/* card */}
          <div className="glass-liquid-apple rounded-[2rem] p-6 shadow-2xl">
            <div className="pointer-events-none mb-6 flex justify-center">
              <div className="relative h-36 w-36 rounded-[2rem] glass-liquid-apple shadow-[0_30px_80px_rgba(0,35,140,0.35)]">
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.88)_0_10%,rgba(255,255,255,0.44)_10_18%,rgba(255,255,255,0.14)_18_28%,transparent_28%),radial-gradient(circle_at_50%_38%,rgba(93,145,255,0.95)_0_23%,rgba(39,102,241,0.88)_23_40%,rgba(15,56,193,0.92)_40_58%,rgba(8,31,132,1)_58_100%)] opacity-90" />
                <div className="absolute left-1/2 top-7 h-16 w-16 -translate-x-1/2 rounded-full border border-white/60 bg-white/70 shadow-[inset_0_0_18px_rgba(255,255,255,0.55)]" />
                <div className="absolute left-1/2 top-20 h-28 w-9 -translate-x-1/2 rounded-full border border-white/50 bg-white/58 shadow-[inset_0_-10px_18px_rgba(0,0,0,0.08)]" />
                <div className="absolute inset-x-5 top-5 h-10 rounded-full bg-white/25 blur-xl" />
                <div className="absolute inset-x-6 bottom-5 h-8 rounded-full bg-black/20 blur-2xl" />
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-foreground rounded-lg bg-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-foreground rounded-lg bg-transparent"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="glass-liquid-apple w-full py-2 text-background rounded-xl hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>
            
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link to="/signup" className="text-foreground hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}