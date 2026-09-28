import type { NotificationApi, NotificationsResponseApi } from "@/types/api";

type ChargerPageNotifications = (
  cursor: string | null,
  limite: number,
) => Promise<NotificationsResponseApi>;

export function notificationEstVisible(notification: Pick<NotificationApi, "type" | "href">) {
  return notification.type.trim().toUpperCase() !== "CERCLE"
    && !/^\/cercles(?:[/?#]|$)/i.test(notification.href?.trim() || "");
}

function curseurSuivant(page: NotificationsResponseApi, visites: Set<string>): string | null {
  if (!page.hasMore) return null;
  const cursor = page.nextCursor;
  if (!cursor || visites.has(cursor)) throw new Error("Pagination des notifications incohérente.");
  visites.add(cursor);
  return cursor;
}

/** Conserve le curseur serveur, même lorsqu'une page entière est masquée. */
export async function chargerPageNotificationsVisibles(
  charger: ChargerPageNotifications,
  cursor: string | null = null,
) {
  const visites = new Set<string>(cursor ? [cursor] : []);
  while (true) {
    const page = await charger(cursor, 20);
    const notifications = page.notifications.filter(notificationEstVisible);
    const nextCursor = curseurSuivant(page, visites);
    if (notifications.length || !nextCursor) return { notifications, hasMore: Boolean(nextCursor), nextCursor };
    cursor = nextCursor;
  }
}

/** Lit jusqu'à retrouver toutes les non lues, sans parcourir l'ancien historique lu. */
export async function lireNotificationsNonLuesVisibles(charger: ChargerPageNotifications) {
  const nonLues = new Map<string, NotificationApi>();
  const toutesNonLues = new Set<string>();
  const visites = new Set<string>();
  let cursor: string | null = null;
  let totalNonLues: number | null = null;
  do {
    const page = await charger(cursor, 50);
    if (totalNonLues === null && Number.isFinite(page.nonLues) && page.nonLues >= 0) {
      totalNonLues = page.nonLues;
    }
    for (const notification of page.notifications) {
      if (notification.lue) continue;
      toutesNonLues.add(notification.id);
      if (notificationEstVisible(notification)) nonLues.set(notification.id, notification);
    }
    if (totalNonLues !== null && toutesNonLues.size >= totalNonLues) break;
    cursor = curseurSuivant(page, visites);
  } while (cursor);
  return [...nonLues.values()];
}
