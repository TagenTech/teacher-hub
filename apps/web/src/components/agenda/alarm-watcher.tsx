'use client';

import { displayName, LessonStatus } from '@turmei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useLessons } from '@/lib/queries/agenda';
import { useNow } from '@/lib/use-now';
import { useToday } from '@/lib/use-today';

export const INAPP_ALARM_KEY = 'turmei_inapp_alarm';

function inAppEnabled() {
  try {
    return localStorage.getItem(INAPP_ALARM_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Som suave de três notas (Web Audio) — sem arquivo de áudio. */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* sem áudio */
  }
}

/** Com o app aberto: toca e mostra um aviso quando a aula está chegando. */
export function AlarmWatcher() {
  const { teacher } = useAuth();
  const today = useToday();
  const now = useNow();
  const { data } = useLessons(today ?? '', today ?? '', undefined, !!today);
  const fired = React.useRef(new Set<string>());

  React.useEffect(() => {
    const minutes = teacher?.lessonReminderMinutes ?? 0;
    if (!now || !data || !minutes || !inAppEnabled()) return;
    for (const l of data) {
      if (l.status !== LessonStatus.AGENDADA) continue;
      const diff = (new Date(l.startsAt).getTime() - now) / 60_000;
      const key = `turmei_alarm_${l.id}`;
      if (diff > 0 && diff <= minutes && !fired.current.has(l.id)) {
        fired.current.add(l.id);
        try {
          if (sessionStorage.getItem(key)) continue;
          sessionStorage.setItem(key, '1');
        } catch {
          /* ignora */
        }
        chime();
        navigator.vibrate?.([200, 100, 200]);
        toast(`🎵 Aula com ${displayName(l.student)} em ${Math.round(diff)} min`, { duration: 15_000 });
      }
    }
  }, [now, data, teacher?.lessonReminderMinutes]);

  return null;
}
