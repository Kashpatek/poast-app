// Fire-and-forget client tracker. POSTs an event to /api/poast-events with
// the current user/role inferred from localStorage. Never throws. Never
// awaits (callers don't need to know whether the event landed).

const ROLES: Record<string, string> = {
  Akash: "Director",
  Vansh: "Social Media Manager",
  Michelle: "Marketing",
  Analyst: "Analyst",
};

export function trackEvent(event: string, payload?: Record<string, unknown>, sec?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const user = localStorage.getItem("poast-current-user") || "anon";
    const role = ROLES[user] || "anon";
    const body = JSON.stringify({
      event,
      user,
      role,
      sec: sec || null,
      payload: payload || {},
      ts: Date.now(),
    });
    // Use sendBeacon when available so events still land on tab close.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/poast-events", blob);
      return;
    }
    fetch("/api/poast-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(function() {});
  } catch (e) {
    // swallow
  }
}
