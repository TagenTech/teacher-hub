'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { financeApi } from '@/lib/api/finance';
import { useWhatsappMessage } from '@/lib/queries/finance';
import { useHydrated } from '@/lib/use-hydrated';

/**
 * Mensagem de cobrança pronta no WhatsApp. A mensagem é buscada antes do toque, então o botão já é um
 * link de verdade: nada de abrir uma aba em branco para só depois preencher (ela ficava sobrando ao voltar).
 * No celular o link abre na mesma aba (o sistema entrega para o app do WhatsApp e esta tela continua aqui);
 * no computador abre uma aba nova, sem acesso à nossa (noopener). Sem telefone, copia o texto.
 */
export function WhatsappChargeButton({ chargeId, label = 'Cobrar no WhatsApp', ...props }: { chargeId: string; label?: string } & ButtonProps) {
  const { data: msg, isError, refetch } = useWhatsappMessage(chargeId);
  const touch = useHydrated() && window.matchMedia('(pointer: coarse)').matches;

  if (msg?.url) {
    return (
      <Button {...props} asChild>
        <a href={msg.url} target={touch ? '_self' : '_blank'} rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <MessageCircle /> {label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      {...props}
      loading={!msg && !isError}
      onClick={async (e) => {
        e.stopPropagation();
        const m = msg ?? (await refetch()).data;
        if (!m) {
          toast.error('Não foi possível montar a mensagem');
          return;
        }
        await navigator.clipboard?.writeText(m.text).catch(() => undefined);
        toast(m.url ? 'Mensagem copiada' : `${m.recipientName} não tem telefone — mensagem copiada 📋`);
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
