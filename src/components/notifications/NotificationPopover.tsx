"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Package,
  Calendar,
  Clock,
  CheckSquare,
  AlertTriangle,
  ShieldAlert,
  Factory,
  Smartphone,
  ExternalLink,
  Info,
  Banknote,
  ReceiptText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface InAppNotification {
  id: string;
  rule_type: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

const LS_KEY = "tas_notif_read_ids";

function getLocalReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveLocalReadId(id: string) {
  try {
    const ids = getLocalReadIds();
    ids.add(id);
    // Keep only last 200 to avoid unbounded growth
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

function saveAllLocalReadIds(ids: string[]) {
  try {
    const existing = getLocalReadIds();
    ids.forEach((id) => existing.add(id));
    const arr = Array.from(existing).slice(-200);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

export function NotificationPopover() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [subscribingPush, setSubscribingPush] = useState(false);

  const { data: notifData } = useQuery<{
    notifications: InAppNotification[];
    unreadCount: number;
  }>({
    queryKey: ["notifications", "in-app"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  useEffect(() => {
    if (notifData) {
      const readIds = getLocalReadIds();
      const notifs: InAppNotification[] = (notifData.notifications || []).map(
        (n: InAppNotification) => ({
          ...n,
          is_read: n.is_read || readIds.has(n.id),
        })
      );
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
    }
  }, [notifData]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            setPushGranted(true);
          } else {
            handleSubscribeWebPush(true);
          }
        }).catch(() => {
          setPushGranted(Notification.permission === "granted");
        });
      }
    }
  }, []);

  const handleMarkAllRead = async () => {
    const allIds = notifications.map((n) => n.id);
    saveAllLocalReadIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (_err) {}
    toast.success("All notifications marked as read");
  };

  const handleMarkItemRead = async (id: string, linkUrl: string | null) => {
    saveLocalReadId(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    const isSynthetic =
      id.startsWith("overdue-") ||
      id.startsWith("lowstock-") ||
      id.startsWith("due-soon-") ||
      id.startsWith("no-payment-");
    if (!isSynthetic) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [id] }),
        });
      } catch (_err) {}
    }
    if (linkUrl) {
      setOpen(false);
      router.push(linkUrl);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleSubscribeWebPush = async (silent: boolean = false) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      if (!silent) toast.error("Web Push Notifications are not supported in this browser");
      return;
    }

    if (!silent) setSubscribingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (!silent) toast.error("Notification permission denied by user");
        if (!silent) setSubscribingPush(false);
        setPushGranted(false);
        return;
      }

      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          const options: PushSubscriptionOptionsInit = { userVisibleOnly: true };
          if (vapidKey && !vapidKey.includes("placeholder")) {
            options.applicationServerKey = urlBase64ToUint8Array(vapidKey);
          }

          try {
            sub = await reg.pushManager.subscribe(options);
          } catch (_e) {
            try {
              sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
            } catch (_e2) {}
          }
        }

        if (sub) {
          const subJson = sub.toJSON();
          await fetch("/api/notifications/push-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: subJson }),
          });
        }
      }

      setPushGranted(true);
      if (!silent) toast.success("Mobile PWA Web Push notifications enabled!");
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Failed to register mobile notifications");
    } finally {
      if (!silent) setSubscribingPush(false);
    }
  };

  const handleUnsubscribeWebPush = async () => {
    setSubscribingPush(true);
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        }
      }
      await fetch("/api/notifications/push-subscription", { method: "DELETE" });
      setPushGranted(false);
      toast.success("Mobile Push notifications disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to disable notifications");
    } finally {
      setSubscribingPush(false);
    }
  };

  const getNotificationIcon = (ruleType: string) => {
    switch (ruleType) {
      case "low_stock":
        return <Package className="size-4 text-blue-600" />;
      case "overdue":
        return <Clock className="size-4 text-red-600" />;
      case "payment_due":
        return <Calendar className="size-4 text-amber-600" />;
      case "payment_not_received":
        return <Banknote className="size-4 text-orange-600" />;
      case "lot_complete":
        return <CheckSquare className="size-4 text-green-600" />;
      case "cheque_bounce":
        return <ShieldAlert className="size-4 text-red-600" />;
      case "stage_delay":
        return <Factory className="size-4 text-orange-600" />;
      default:
        return <Bell className="size-4 text-slate-600" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (isOpen) queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] }); }}>
      <DropdownMenuTrigger
        className="relative w-9 h-9 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--page-bg)] transition-colors cursor-pointer outline-none select-none"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl z-50 text-left overflow-hidden"
      >
        {/* Header */}
        <div className="p-3.5 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--page-bg)] select-none">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-[var(--primary)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* PWA Mobile Push Prompt */}
        <div className="p-2.5 bg-[#EFF6FF] dark:bg-[#1E1B4B] border-b border-[var(--border-light)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[#1D4ED8] dark:text-[#818CF8]">
            <Smartphone className="size-4 shrink-0" />
            <span className="text-[11px] font-medium leading-tight">
              {pushGranted ? "Mobile push alerts active" : "Get mobile alerts on your phone"}
            </span>
          </div>
          {pushGranted ? (
            <button
              onClick={handleUnsubscribeWebPush}
              disabled={subscribingPush}
              className="h-7 px-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {subscribingPush ? "Disabling..." : "Disable Push"}
            </button>
          ) : (
            <button
              onClick={() => handleSubscribeWebPush(false)}
              disabled={subscribingPush}
              className="h-7 px-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[10px] font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {subscribingPush ? "Enabling..." : "Enable Push"}
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[350px] overflow-y-auto divide-y divide-[var(--border-light)] scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Bell className="size-8 text-[var(--text-faint)]" />
              <span className="text-xs font-semibold">No notifications yet</span>
              <span className="text-[11px] text-[var(--text-faint)] max-w-[200px]">
                System alerts like Low Stock, Payment Reminders, and Lot Complete will appear here.
              </span>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkItemRead(n.id, n.link_url)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[var(--page-bg)] ${
                  !n.is_read ? "bg-[var(--primary-light)]/30 font-medium" : ""
                }`}
              >
                <div className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] shrink-0 mt-0.5">
                  {getNotificationIcon(n.rule_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {n.title}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] shrink-0 font-normal">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-body)] mt-0.5 leading-snug line-clamp-2">
                    {n.message}
                  </p>
                  {n.link_url && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--primary)] mt-1.5 hover:underline">
                      View details <ExternalLink size={10} />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
