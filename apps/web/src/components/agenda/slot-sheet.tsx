'use client';

import { formatDateShort, LessonMode, WEEKDAYS, WEEKDAYS_SHORT, type SlotDto } from '@turmei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useEndSlot, useUpdateSlot } from '@/lib/queries/agenda';
import { cn, haptic } from '@/lib/utils';
import { DurationChips } from './duration-chips';
import { LessonPlaceFields, type PlaceValue } from './lesson-place-fields';

const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError ? (err.details?.[0] ?? err.message) : fallback);

/** Edita um horário fixo a partir de uma data ("esta e as próximas") ou encerra. */
export function SlotSheet({ slot, today, onClose }: { slot: SlotDto | null; today: string; onClose: () => void }) {
  const update = useUpdateSlot();
  const end = useEndSlot();
  const [weekday, setWeekday] = React.useState(1);
  const [time, setTime] = React.useState('19:00');
  const [duration, setDuration] = React.useState(60);
  const [place, setPlace] = React.useState<PlaceValue>({ mode: LessonMode.PRESENCIAL, location: '', meetingUrl: '' });
  const [from, setFrom] = React.useState(today);
  const [loaded, setLoaded] = React.useState<string | null>(null);

  if (slot && loaded !== slot.id) {
    setLoaded(slot.id);
    setWeekday(slot.weekday);
    setTime(slot.startTime);
    setDuration(slot.durationMin);
    setPlace({ mode: slot.mode, location: slot.location ?? '', meetingUrl: slot.meetingUrl ?? '' });
    setFrom(today);
  }

  return (
    <Sheet
      open={!!slot}
      onOpenChange={(o) => {
        if (!o) {
          setLoaded(null);
          onClose();
        }
      }}
      title="Horário fixo"
      description={slot ? `Toda ${WEEKDAYS[slot.weekday]} às ${slot.startTime}` : undefined}
    >
      {slot ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="pl-1 text-sm font-semibold">Dia da semana</p>
            <div role="radiogroup" aria-label="Dia da semana" className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={weekday === d}
                  aria-label={WEEKDAYS[d]}
                  onClick={() => setWeekday(d)}
                  className={cn(
                    'rounded-xl py-2.5 text-sm font-bold uppercase transition-all',
                    weekday === d ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {WEEKDAYS_SHORT[d]}
                </button>
              ))}
            </div>
          </div>
          <Field label="Horário" htmlFor="slot-time">
            <Input id="slot-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <DurationChips value={duration} onChange={setDuration} />
          <LessonPlaceFields value={place} onChange={setPlace} />
          <Field label="Mudança vale a partir de" htmlFor="slot-from" hint="Aulas antes dessa data não mudam.">
            <Input id="slot-from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Button
            block
            size="lg"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: slot.id,
                  body: {
                    weekday,
                    startTime: time,
                    durationMin: duration,
                    mode: place.mode,
                    location: place.mode === LessonMode.PRESENCIAL ? place.location.trim() || null : null,
                    meetingUrl: place.mode === LessonMode.ONLINE ? place.meetingUrl.trim() || null : null,
                    effectiveFrom: from,
                  },
                },
                {
                  onSuccess: () => {
                    haptic(15);
                    toast.success(`Horário atualizado a partir de ${formatDateShort(from, false)} ✨`);
                    setLoaded(null);
                    onClose();
                  },
                  onError: (err) => toast.error(errMsg(err, 'Não foi possível salvar')),
                },
              )
            }
          >
            Salvar a partir de {formatDateShort(from, false)}
          </Button>
          <Button
            variant="danger"
            block
            loading={end.isPending}
            onClick={() =>
              end.mutate(
                { id: slot.id, from },
                {
                  onSuccess: () => {
                    toast(`Horário encerrado a partir de ${formatDateShort(from, false)}`);
                    setLoaded(null);
                    onClose();
                  },
                  onError: (err) => toast.error(errMsg(err, 'Não foi possível encerrar')),
                },
              )
            }
          >
            Encerrar este horário a partir de {formatDateShort(from, false)}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
