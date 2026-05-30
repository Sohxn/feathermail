import { Email } from "@/types/email";
import { EmailListItem } from "./EmailListItem";
import { Search, ArrowUpDown, Clock } from "lucide-react";
import { useState } from "react";
import { sortByUrgency } from "@/hooks/useTimeAwareness";

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  onToggleStar: (emailId: string) => void;
  folderName: string;
}

export function EmailList({ 
  emails, 
  selectedEmailId, 
  onSelectEmail, 
  onToggleStar,
  folderName 
}: EmailListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"urgency" | "date">("urgency");

  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedEmails = sortMode === "date"
    ? [...filteredEmails].sort((a, b) => b.date.getTime() - a.date.getTime())
    : filteredEmails; // already sorted by urgency from parent

  const handleToggleStar = (emailId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(emailId);
  };

  return (
    <div className="w-96 flex flex-col">
      {/* Search */}
      <div className="h-14 flex items-center px-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-secondary rounded-md border-0 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide">
          {folderName} ({sortedEmails.length})
        </h2>
        <button
          onClick={() => setSortMode(s => s === "urgency" ? "date" : "urgency")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          title={sortMode === "urgency" ? "Sorted by urgency" : "Sorted by date"}
        >
          {sortMode === "urgency" ? <ArrowUpDown className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {sortMode === "urgency" ? "Urgency" : "Newest"}
        </button>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {sortedEmails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No emails found
          </div>
        ) : (
          sortedEmails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              isSelected={selectedEmailId === email.id}
              onClick={() => onSelectEmail(email)}
              onToggleStar={handleToggleStar(email.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
