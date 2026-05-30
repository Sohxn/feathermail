import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  Inbox, Star, Send, FileText, Archive, Trash2,
  PenSquare, ExternalLink, Settings, Mail, ChevronRight, X,
} from "lucide-react";

interface FolderCount {
  inbox: number; starred: number; sent: number;
  drafts: number; archive: number; trash: number;
}
interface EmailAccount {
  id: string; email_address: string; provider: string; is_primary: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox, starred: Star, sent: Send,
  drafts: FileText, archive: Archive, trash: Trash2,
};
const folderConfig = [
  { id: "inbox",   name: "Inbox",   icon: "inbox"   },
  { id: "starred", name: "Starred", icon: "starred" },
  { id: "sent",    name: "Sent",    icon: "sent"    },
  { id: "drafts",  name: "Drafts",  icon: "drafts"  },
  { id: "archive", name: "Archive", icon: "archive" },
  { id: "trash",   name: "Trash",   icon: "trash"   },
];

interface EmailSidebarProps {
  activeFolder: string;
  onFolderChange: (id: string) => void;
  onCompose: () => void;
  onOpenSettings: () => void;
  folderCounts: FolderCount;
  accounts: EmailAccount[];
  selectedAccountId: string | null;
  onAccountChange: (id: string | null) => void;
  /** optional — called when mobile X button is tapped */
  onClose?: () => void;
}

export default function EmailSidebar({
  activeFolder, onFolderChange, onCompose, onOpenSettings,
  folderCounts, accounts, selectedAccountId, onAccountChange, onClose,
}: EmailSidebarProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isNeo = theme === "neo";

  return (
    <aside className={cn(
      "w-full md:w-56 flex flex-col h-full border backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.42)] overflow-hidden",
      isNeo ? "border-border bg-background" : "border-border/80 bg-background/82"
    )}>

      {/* Logo row */}
      <div className="h-14 m-2 flex items-center justify-between px-4 flex-shrink-0">
        <span
          className="font-semibold tracking-tight text-[4vh] text-white"
          style={{ fontFamily: "var(--font-family-brand, 'Roboto', sans-serif)", fontWeight: "var(--font-weight-semibold, 600)" }}
        >
          Feathermail
        </span>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 hover:bg-secondary rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Account Selector */}
      <div className="p-3 flex-shrink-0">
        <div className="text-sm font-medium text-muted-foreground mb-2 px-1 ml-1">ACCOUNTS</div>

        <button
          onClick={() => onAccountChange(null)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors mb-1 glass",
            selectedAccountId === null
              ? isNeo
                ? "border border-border bg-primary text-primary-foreground"
                : "border border-white/20 bg-white/[0.08] text-foreground"
              : isNeo
                ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">All Accounts</span>
          </div>
          {selectedAccountId === null && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        </button>

        {accounts.map(account => (
          <button
            key={account.id}
            onClick={() => onAccountChange(account.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors mb-1",
              selectedAccountId === account.id
                ? isNeo
                  ? "border border-border bg-primary text-primary-foreground"
                  : "border border-white/20 bg-white/[0.08] text-foreground"
                : "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 p-2 shadow-none",
                  isNeo ? "border-border bg-primary text-primary-foreground" : "border-white/25 bg-transparent"
                )}>
                <span className="text-[8px] font-bold">{account.email_address[0].toUpperCase()}</span>
              </div>
              <span className="truncate text-xs">{account.email_address}</span>
            </div>
            {selectedAccountId === account.id && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
          </button>
        ))}
      </div>

      {/* Compose */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={onCompose}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors glass",
            isNeo
              ? "bg-primary text-primary-foreground hover:bg-accent"
              : "text-background hover:bg-foreground/90"
          )}
        >
          <PenSquare className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-3 py-1 overflow-y-auto">

        <div className="text-sm font-medium text-muted-foreground mb-2 px-1 ml-1">FOLDERS</div>

        {folderConfig.map(folder => {
          const Icon = iconMap[folder.icon];
          const isActive = activeFolder === folder.id;
          const count = folderCounts[folder.id as keyof FolderCount];
          return (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors rounded-xl mb-1",
                isActive
                  ? isNeo
                    ? "glass border border-border bg-card text-foreground"
                    : "glass border border-white/12 text-foreground"
                  : isNeo
                    ? "text-muted-foreground hover:bg-secondary"
                    : "text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4" />}
                <span>{folder.name}</span>
              </div>
              {count > 0 && (
                <span className={cn("text-xs tabular-nums", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings & Dashboard */}
      <div className="px-3 pb-4 space-y-1 flex-shrink-0">
        <button
          onClick={onOpenSettings}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
            isNeo ? "text-muted-foreground hover:bg-secondary" : "text-muted-foreground hover:bg-secondary/50"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
            isNeo ? "text-muted-foreground hover:bg-secondary" : "text-muted-foreground hover:bg-secondary/50"
          )}
        >
          <ExternalLink className="w-4 h-4" />
          Manage Accounts
        </button>
      </div>
    </aside>
  );
}