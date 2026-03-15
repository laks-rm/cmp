"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, Check, FileText, AlertTriangle, CheckSquare, BookOpen, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fetchApi, patch } from "@/lib/api-client";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  TASK_SUBMITTED: { icon: CheckSquare, color: "var(--blue)" },
  TASK_APPROVED: { icon: Check, color: "var(--green)" },
  TASK_REJECTED: { icon: AlertTriangle, color: "var(--amber)" },
  TASK_ASSIGNED: { icon: CheckSquare, color: "var(--blue)" },
  TASK_OVERDUE: { icon: AlertTriangle, color: "var(--red)" },
  FINDING_CREATED: { icon: AlertTriangle, color: "var(--red)" },
  FINDING_OVERDUE: { icon: AlertTriangle, color: "var(--red)" },
  SOURCE_GENERATED: { icon: BookOpen, color: "var(--purple)" },
  COMMENT_ADDED: { icon: FileText, color: "var(--blue)" },
};

export function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const data = await fetchApi<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications?limit=20",
        { showErrorToast: false } // Silent polling
      );
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string, linkUrl: string | null) => {
    try {
      await patch(`/api/notifications/${notificationId}`, undefined, { showErrorToast: false });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (linkUrl) {
        router.push(linkUrl);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await patch("/api/notifications", { action: "mark-all-read" }, { showErrorToast: false });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!session?.user) return null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-2 transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--red)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-[14px] border bg-white shadow-2xl"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ color: "var(--blue)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[480px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Bell size={48} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  No notifications yet
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  We&apos;ll notify you when something happens
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const iconConfig = NOTIFICATION_ICONS[notification.type] || {
                  icon: Bell,
                  color: "var(--text-muted)",
                };
                const Icon = iconConfig.icon;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleMarkAsRead(notification.id, notification.linkUrl)}
                    className="flex w-full gap-3 border-b p-4 text-left transition-colors"
                    style={{
                      borderColor: "var(--border-light)",
                      backgroundColor: notification.isRead ? "transparent" : "var(--blue-light)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = notification.isRead
                        ? "transparent"
                        : "var(--blue-light)")
                    }
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: iconConfig.color + "20" }}
                    >
                      <Icon size={18} style={{ color: iconConfig.color }} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div
                        className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: "var(--blue)" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
