import { formatDistanceToNow } from "date-fns";

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
  return (
    <div
      onClick={onClick}
      // "glass" is the base class from App.css
      // "selected" is the modifier — must be a plain class name, not a Tailwind utility
      className={`glass${isSelected ? " selected" : ""} mx-1 my-2 rounded-2xl p-4 cursor-pointer`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`truncate ${!email.is_read ? "font-bold" : "font-medium"}`}>
            {email.from_name || email.from_email}
          </span>
          {email.is_starred && (
            <span className="text-yellow-500 flex-shrink-0 text-xs">★</span>
          )}
        </div>
        <span className="glass p-1.5 rounded-xl text-xs text-foreground whitespace-nowrap ml-2 mb-2 flex-shrink-0">
          {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
        </span>
      </div>

      <div className={`text-sm mb-1 truncate ${!email.is_read ? "font-semibold" : ""}`}>
        {email.subject || "(No Subject)"}
      </div>

      <div className="text-xs text-mailbody truncate">
        {email.snippet || "No preview available"}
      </div>

      {email.email_accounts && (
        <div className="mt-2">
          {/* semi-transparent pill so it blends with the glass surface */}
          <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
            {email.email_accounts.email_address}
          </span>
        </div>
      )}

      <div className="mt-3 h-fit w-fit">
        <span className="glass rounded-lg text-xs p-1.5 mr-2">
          $4000
        </span>

        <span className="glass rounded-lg text-xs p-1.5">
          02-05-2026
        </span>
      </div>

      
    </div>
  );
}