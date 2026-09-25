"use server";
import { cookies } from "next/headers";

export type CalendarItem = { title: string; meta: string; badge: string; description: string; attendees: string[] };

/** The viewer's real upcoming meetings (Google Calendar, read-only), or null if not connected / token expired. */
export async function calendarEvents(): Promise<CalendarItem[] | null> {
  const token = (await cookies()).get("gcal_token")?.value;
  if (!token) return null;
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.search = new URLSearchParams({ timeMin: new Date().toISOString(), maxResults: "8", singleEvents: "true", orderBy: "startTime" }).toString();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) { console.error("calendar fetch", res.status); return null; }
  const data = (await res.json()) as { items?: { summary?: string; description?: string; start?: { dateTime?: string; date?: string }; attendees?: { email: string; displayName?: string; responseStatus?: string }[]; organizer?: { email?: string; displayName?: string } }[] };
  return (data.items ?? []).map((e) => {
    const start = e.start?.dateTime ?? e.start?.date ?? "";
    const when = start ? new Date(start).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
    const people = (e.attendees ?? []).map((a) => `${a.displayName ?? a.email} (${a.responseStatus ?? "unknown"})`);
    return { title: e.summary ?? "(no title)", meta: `${when}${e.organizer?.displayName || e.organizer?.email ? ` · ${e.organizer.displayName ?? e.organizer.email}` : ""}`, badge: people.length ? `${people.length} people` : "", description: (e.description ?? "").slice(0, 800), attendees: people.slice(0, 20) };
  });
}
