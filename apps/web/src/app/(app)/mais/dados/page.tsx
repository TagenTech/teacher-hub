'use client';

import { Download, FileJson, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFile } from '@/lib/api/client';
import { reportsApi } from '@/lib/api/reports';
import { useToday } from '@/lib/use-today';

const CSVS = [
  ['pagamentos', 'Pagamentos'],
  ['cobrancas', 'Cobranças'],
  ['aulas', 'Aulas'],
  ['frequencia', 'Frequência'],
] as const;

export default function DadosPage() {
  const back = useBack('/mais');
  const today = useToday();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      toast.success('Arquivo baixado ✓');
    } catch {
      toast.error('Não foi possível baixar');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <FormTopBar onBack={back} title="Meus dados" />
      <div className="space-y-5 px-5 pb-8">
        <Card className="flex gap-3 bg-success-soft">
          <ShieldCheck className="size-6 shrink-0 text-success-soft-foreground" />
          <p className="text-sm text-success-soft-foreground">
            Os dados são seus. Baixe uma cópia completa quando quiser — serve de backup e para levar para outro sistema.
          </p>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
              <FileJson className="size-5" />
            </span>
            <div>
              <p className="font-display font-extrabold">Cópia completa (JSON)</p>
              <p className="text-sm text-muted-foreground">Alunos, planos, aulas, cobranças e pagamentos.</p>
            </div>
          </div>
          <Button block loading={busy === 'json'} onClick={() => run('json', () => downloadFile('/me/export', 'turmei-meus-dados.json'))}>
            <Download /> Baixar tudo
          </Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-success-soft text-success-soft-foreground">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <p className="font-display font-extrabold">Planilhas (CSV) — últimos 12 meses</p>
              <p className="text-sm text-muted-foreground">Abrem no Excel e no Google Planilhas.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CSVS.map(([type, label]) => (
              <Button
                key={type}
                variant="soft"
                loading={busy === type}
                disabled={!today}
                onClick={() =>
                  run(type, () =>
                    reportsApi.exportCsv(type, {
                      from: `${Number(today!.slice(0, 4)) - 1}${today!.slice(4)}`,
                      to: today!,
                    }),
                  )
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
        <p className="px-1 text-sm text-muted-foreground">
          Quer apagar tudo? Vá em Mais → Segurança da conta → Excluir minha conta.
        </p>
      </div>
    </>
  );
}
