import { connection } from "next/server";
import { calendarToday } from "@/lib/contact-tracking";
import { serverTimeZone } from "@/lib/freshness";

export async function requestCalendarToday() {
  const clock = await requestClock();
  return clock.today;
}

export async function requestClock() {
  await connection();
  const now = new Date();
  return {
    today: calendarToday(now),
    observedAt: now.toISOString(),
    timeZone: serverTimeZone(),
  };
}
