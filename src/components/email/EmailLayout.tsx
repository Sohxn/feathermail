import { useState, useEffect, useCallback, useMemo } from "react";
import EmailSidebar from "./EmailSidebar";
import { EmailList } from "./EmailList";
import EmailView from "./EmailView";
import { ComposeModal } from "./ComposeModal";
import { SettingsPanel } from "./SettingsPanel";
import { mockEmails as initialEmails } from "@/data/mockEmails";
import { Email } from "@/types/email";
import { toast } from "sonner";
import { sortByUrgency, useTimeTick } from "@/hooks/useTimeAwareness";

// Get saved wallpaper from localStorage
function getSavedWallpaper(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("wallpaper") || "";
  }
  return "";
}

export default function EmailLayout() {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState(getSavedWallpaper);

  // Save wallpaper to localStorage when it changes
  const handleWallpaperChange = (newWallpaper: string) => {
    setWallpaper(newWallpaper);
    localStorage.setItem("wallpaper", newWallpaper);
  };

  // Tick every minute to keep time displays fresh
  const tick = useTimeTick();

  // Filter emails based on active folder, then sort by urgency
  const filteredEmails = useMemo(() => {
    let result: Email[];
    switch (activeFolder) {
      case "inbox":
        result = emails.filter(e => e.folder === "inbox" && !e.archived && !e.trashed);
        break;
      case "starred":
        result = emails.filter(e => e.starred && !e.trashed);
        break;
      case "sent":
        result = emails.filter(e => e.folder === "sent" && !e.trashed);
        break;
      case "drafts":
        result = emails.filter(e => e.folder === "drafts" && !e.trashed);
        break;
      case "archive":
        result = emails.filter(e => e.archived && !e.trashed);
        break;
      case "trash":
        result = emails.filter(e => e.trashed);
        break;
      default:
        result = emails.filter(e => !e.archived && !e.trashed);
    }
    return sortByUrgency(result);
  }, [activeFolder, emails, tick]);

  // Calculate folder counts
  const folderCounts = useMemo(() => ({
    inbox: emails.filter(e => e.folder === "inbox" && !e.archived && !e.trashed && !e.read).length,
    starred: emails.filter(e => e.starred && !e.trashed).length,
    sent: emails.filter(e => e.folder === "sent" && !e.trashed).length,
    drafts: emails.filter(e => e.folder === "drafts" && !e.trashed).length,
    archive: emails.filter(e => e.archived && !e.trashed).length,
    trash: emails.filter(e => e.trashed).length,
  }), [emails]);

  // Auto-select first email when folder changes
  useEffect(() => {
    if (filteredEmails.length > 0) {
      setSelectedEmail(filteredEmails[0]);
    } else {
      setSelectedEmail(null);
    }
  }, [activeFolder]);

  const selectedIndex = filteredEmails.findIndex((e) => e.id === selectedEmail?.id);

  // Toggle star on email
  const handleToggleStar = useCallback((emailId: string) => {
    setEmails(prev => prev.map(email => 
      email.id === emailId ? { ...email, starred: !email.starred } : email
    ));
  }, []);

  // Archive email
  const handleArchive = useCallback(() => {
    if (!selectedEmail) return;
    
    setEmails(prev => prev.map(email => 
      email.id === selectedEmail.id ? { ...email, archived: true } : email
    ));
    toast.success("Email archived");
    
    // Select next email
    const nextIndex = Math.min(selectedIndex + 1, filteredEmails.length - 1);
    if (nextIndex !== selectedIndex && filteredEmails[nextIndex]) {
      setSelectedEmail(filteredEmails[nextIndex]);
    }
  }, [selectedEmail, selectedIndex, filteredEmails]);

  // Trash email
  const handleTrash = useCallback(() => {
    if (!selectedEmail) return;
    
    setEmails(prev => prev.map(email => 
      email.id === selectedEmail.id ? { ...email, trashed: true } : email
    ));
    toast.success("Email moved to trash");
    
    // Select next email
    const nextIndex = Math.min(selectedIndex + 1, filteredEmails.length - 1);
    if (nextIndex !== selectedIndex && filteredEmails[nextIndex]) {
      setSelectedEmail(filteredEmails[nextIndex]);
    }
  }, [selectedEmail, selectedIndex, filteredEmails]);

  // Restore email from trash
  const handleRestore = useCallback(() => {
    if (!selectedEmail) return;
    
    setEmails(prev => prev.map(email => 
      email.id === selectedEmail.id ? { ...email, trashed: false } : email
    ));
    toast.success("Email restored");
  }, [selectedEmail]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle if compose modal is open or typing in input
      if (isComposeOpen || isSettingsOpen) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, filteredEmails.length - 1);
        setSelectedEmail(filteredEmails[nextIndex]);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, 0);
        setSelectedEmail(filteredEmails[prevIndex]);
      } else if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        if (selectedEmail) {
          handleToggleStar(selectedEmail.id);
        }
      } else if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        handleArchive();
      } else if (event.key === "#") {
        event.preventDefault();
        handleTrash();
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        setIsComposeOpen(true);
      }
    },
    [selectedIndex, filteredEmails, selectedEmail, isComposeOpen, isSettingsOpen, handleToggleStar, handleArchive, handleTrash]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Mark email as read and update lastActivity when selected
  useEffect(() => {
    if (selectedEmail) {
      setEmails(prev => prev.map(email =>
        email.id === selectedEmail.id 
          ? { ...email, read: true, lastActivity: new Date() } 
          : email
      ));
    }
  }, [selectedEmail]);

  const folderNames: Record<string, string> = {
    inbox: "Inbox",
    starred: "Starred",
    sent: "Sent",
    drafts: "Drafts",
    archive: "Archive",
    trash: "Trash",
  };

  return (
    <div 
      className="h-screen flex"
      style={{ background: wallpaper || "var(--background)" }}
    >
      <EmailSidebar
        activeFolder={activeFolder}
        onFolderChange={setActiveFolder}
        onCompose={() => setIsComposeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        folderCounts={folderCounts}
        accounts={[]}
        selectedAccountId={null}
        onAccountChange={() => {}}
      />
      <EmailList
        emails={filteredEmails}
        selectedEmailId={selectedEmail?.id ?? null}
        onSelectEmail={setSelectedEmail}
        onToggleStar={handleToggleStar}
        folderName={folderNames[activeFolder] || "Inbox"}
      />
      <EmailView 
        email={selectedEmail} 
        onArchive={handleArchive}
        onTrash={handleTrash}
        onToggleStar={() => selectedEmail && handleToggleStar(selectedEmail.id)}
        onRestore={handleRestore}
      />
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentWallpaper={wallpaper}
        onWallpaperChange={handleWallpaperChange}
      />
    </div>
  );
}
