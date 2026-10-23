'use client';

import { Copy, MessageCircle } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { financeApi } from '@/lib/api/finance';
import { ApiError } from '@/lib/api/client';

/** Busca a mensagem pronta e abre o WhatsApp; sem telefone, copia o texto. */
export function WhatsappChargeButton({ chargeId, label = 'Cobrar no WhatsApp', ...props }: { chargeId: string; label?: string } & ButtonProps) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      {...props}
      loading={loading}
      onClick={async (e) => {
        e.stopPropagation();
        // Abre a janela já no clique (iOS bloqueia janelas abertas depois de um await).
        const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
        // A aba nova não pode controlar a nossa (reverse tabnabbing).
        if (win) win.opener = null;
        setLoading(true);
        try {
          const msg = await financeApi.whatsapp(chargeId);
          if (msg.url && win) {
            win.location.href = msg.url;
          } else {
            win?.close();
            await navigator.clipboard?.writeText(msg.text).catch(() => undefined);
            toast(msg.url ? 'Mensagem copiada' : `${msg.recipientName} não tem telefone — mensagem copiada 📋`);
          }
        } catch (err) {
          win?.close();
          toast.error(err instanceof ApiError ? err.message : 'Não foi possível montar a mensagem');
        } finally {
          setLoading(false);
        }
      }}
    >
      <MessageCircle /> {label}
    </Button>
  );
}

export function CopyMessageButton({ chargeId }: { chargeId: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const msg = await financeApi.whatsapp(chargeId);
        await navigator.clipboard?.writeText(msg.text);
        toast('Mensagem copiada 📋');
      }}
    >
      <Copy className="!size-4" /> Copiar mensagem
    </Button>
  );
}
