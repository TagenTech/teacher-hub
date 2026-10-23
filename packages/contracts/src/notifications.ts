export interface PushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel?: string;
}

export interface PushStatusDto {
  publicKey: string | null;
  enabled: boolean;
  devices: { id: string; deviceLabel: string | null; lastSeenAt: string }[];
}

export interface CalendarFeedDto {
  /** URL https do feed .ics (assinar no Google Agenda / iPhone). */
  url: string;
  webcalUrl: string;
}

/** Corpo que o service worker recebe no evento `push`. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  requireInteraction?: boolean;
}
