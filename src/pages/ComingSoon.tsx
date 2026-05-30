import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export default function ComingSoon() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Branding */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-md flex items-center justify-center">
              <Mail className="w-5 h-5 text-background" />
            </div>
            <h1 className="text-xl font-bold " style={{ fontFamily: "var(--font-family-brand)" }}>Feathermail</h1>
          </div>
          
          {/* Privacy Policy Link - Required by Google */}
          <Link 
            to="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      {/* Content - Centered */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          {/* App Purpose - Required by Google */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold mb-6">A Better Email Experience</h2>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Feathermail</strong> is a modern email client that helps you manage multiple email accounts in one unified inbox.
            </p>
            
            <div className="space-y-3 text-base text-muted-foreground max-w-xl mx-auto">
              <p className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Connect Gmail, Outlook, and other email providers</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Organize your emails with smart filters and labels</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Fast, secure, and privacy-focused email management</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                <span>Access all your emails from a single, beautiful interface</span>
              </p>
            </div>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex gap-3 justify-center">
            <Link
              to="/signup"
              className="px-6 py-3 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity font-medium"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 border border-border rounded-md hover:bg-secondary transition-colors font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Footer with Links */}
      <footer className="border-t border-border py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Feathermail. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <Link 
                to="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}