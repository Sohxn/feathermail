import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface EmailListItemProps {
  email: {
    id: string;
    subject: string;
    from_name: string | null;
    from_email: string;
    snippet: string | null;
    received_at: string;
    is_read: boolean;
    is_starred: boolean;
    email_accounts?: {
      email_address: string;
      provider: string;
    };
  };
  isSelected: boolean;
  onClick: () => void;
}

export default function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  const { theme } = useTheme();
  const isNeo = theme === "neo";

  return (
    <div
      onClick={onClick}
      className={cn(
        "mx-1 my-3 rounded-2xl p-4 cursor-pointer transition-colors",
        isNeo
          ? isSelected
            ? "border border-border bg-card text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
            : "border border-border bg-card text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
          : `glass${isSelected ? " selected" : ""}`
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn("truncate", "text-white", !email.is_read ? "font-bold" : "font-medium") }>
            {email.from_name || email.from_email}
          </span>
          {email.is_starred && (
            <span className={cn("flex-shrink-0 text-xs", isNeo ? "text-white" : "text-yellow-500")}>★</span>
          )}
        </div>
        <span className={cn(
          "border-2 p-1.5 rounded-xl text-xs whitespace-nowrap ml-2 mb-2 flex-shrink-0 text-white",
          isNeo ? "border-border bg-secondary" : ""
        )}>
          {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
        </span>
      </div>

      <div className={cn("text-sm mb-1 truncate text-white", !email.is_read ? "font-semibold" : "") }>
        {email.subject || "(No Subject)"}
      </div>

      <div className={cn("text-xs truncate", isNeo ? "text-white/90" : "text-mailbody")}>
        {email.snippet || "No preview available"}
      </div>

      {email.email_accounts && (
        <div className="mt-2">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            isNeo ? "bg-secondary text-secondary-foreground" : "bg-secondary text-secondary-foreground"
          )}>
            {email.email_accounts.email_address}
          </span>
        </div>
      )}

      <div className="mt-3 h-fit w-fit">
        <span className={cn("border-2 rounded-xl text-xs p-1.5 mr-2 text-white", isNeo ? "border-border bg-secondary" : "")}>
          $4000
        </span>

        <span className={cn("border-2 rounded-xl text-xs p-1.5 text-white", isNeo ? "border-border bg-secondary" : "")}>
          02-05-2026
        </span>
      </div>

      
    </div>
  );
}