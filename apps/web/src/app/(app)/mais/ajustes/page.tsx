'use client';

import {
  DEFAULT_WHATSAPP_TEMPLATE,
  fillTemplate,
  PixKeyType,
  type UpdateSettingsRequest,
} from '@aulinha/contracts';
import { KeyRound, User } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { DurationChips } from '@/components/agenda/duration-chips';
import { FormTopBar, StickyActions, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { financeApi } from '@/lib/api/finance';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/utils';

const PIX_TYPES: { v: PixKeyType; l: string }[] = [
  { v: PixKeyType.TELEFONE, l: 'Celular' },
  { v: PixKeyType.EMAIL, l: 'E-mail' },
  { v: PixKeyType.CPF, l: 'CPF' },
  { v: PixKeyType.CNPJ, l: 'CNPJ' },
  { v: PixKeyType.ALEATORIA, l: 'Aleatória' },
];
const VARS = ['{nome}', '{aluno}', '{descricao}', '{valor}', '{vencimento}', '{pix}', '{professor}'];

export default function AjustesPage() {
  const back = useBack('/mais');
  const { teacher, setTeacher } = useAuth();
  const [name, setName] = React.useState(teacher?.name ?? '');
  const [pixKey, setPixKey] = React.useState(teacher?.pixKey ?? '');
  const [pixType, setPixType] = React.useState<PixKeyType | null>(teacher?.pixKeyType ?? null);
  const [duration, setDuration] = React.useState(teacher?.defaultLessonMinutes ?? 60);
  const [template, setTemplate] = React.useState(teacher?.whatsappTemplate ?? '');
  const [saving, setSaving] = React.useState(false);

  const preview = fillTemplate(template || DEFAULT_WHATSAPP_TEMPLATE, {
    nome: 'Marta',
    aluno: 'Aninha',
    descricao: 'mensalidade de novembro',
    valor: 'R$ 280,00',
    vencimento: 'amanhã (10/11)',
    pix: pixKey ? `\nPIX: ${pixKey}` : '',
    professor: name.split(' ')[0] ?? '',
  });

  const save = async () => {
    if (!name.trim()) {
      toast.error('Informe seu nome');
      return;
    }
    setSaving(true);
    try {
      const body: UpdateSettingsRequest = {
        name: name.trim(),
        pixKey: pixKey.trim() || null,
        pixKeyType: pixKey.trim() ? pixType : null,
        defaultLessonMinutes: duration,
        whatsappTemplate: template.trim() || null,
      };
      setTeacher(await financeApi.updateSettings(body));
      haptic(15);
      toast.success('Ajustes salvos ✨');
      back();
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormTopBar onBack={back} title="Ajustes" />
      <div className="space-y-6 px-5">
        <Card className="space-y-4">
          <Field label="Seu nome" htmlFor="st-name">
            <Input id="st-name" icon={<User />} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <DurationChips value={duration} onChange={setDuration} />
          <p className="-mt-2 pl-1 text-sm text-muted-foreground">Duração padrão ao agendar uma aula.</p>
        </Card>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">PIX para receber</h2>
          <Card className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {PIX_TYPES.map((t) => (
                <Chip key={t.v} active={pixType === t.v} onClick={() => setPixType(t.v)}>
                  {t.l}
                </Chip>
              ))}
            </div>
            <Field label="Chave PIX" htmlFor="st-pix" hint="Vai junto na mensagem de cobrança.">
              <Input id="st-pix" icon={<KeyRound />} value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="sua chave" autoCapitalize="none" />
            </Field>
          </Card>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Mensagem de cobrança</h2>
          <Card className="space-y-3">
            <Textarea
              aria-label="Modelo da mensagem"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={DEFAULT_WHATSAPP_TEMPLATE}
              className="min-h-32"
              maxLength={600}
            />
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemplate((t) => (t || DEFAULT_WHATSAPP_TEMPLATE) + ' ' + v)}
                  className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary-soft-foreground"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-success-soft p-3 text-sm text-success-soft-foreground">
              <p className="mb-1 text-xs font-bold uppercase">Prévia</p>
              <p className="whitespace-pre-line">{preview}</p>
            </div>
            <p className="text-xs text-muted-foreground">Em branco, usa a mensagem padrão (com versão própria para atrasos).</p>
          </Card>
        </section>
      </div>
      <StickyActions>
        <Button block size="lg" loading={saving} onClick={save}>
          Salvar ajustes
        </Button>
      </StickyActions>
    </>
  );
}
