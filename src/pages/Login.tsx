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
      navigate("/inbox");
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
          <Link to="/landing" className="text-xl font-bold" style={{ fontFamily: "var(--font-family-brand)" }}>
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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
          </div>

          {/* card */}
          <div className="glass rounded-2xl p-6">
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
                className="glass w-full py-2 text-background rounded-lg hover:opacity-90 disabled:opacity-50"
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