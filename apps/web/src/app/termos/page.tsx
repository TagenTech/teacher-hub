import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Termos de uso' };

// RASCUNHO — revisar com assessoria jurídica antes de abrir cobrança da licença.
export default function TermosPage() {
  return (
    <LegalPage title="Termos de uso" updated="23/10/2026">
      <p>A Aulinha é uma ferramenta para professores organizarem alunos, agenda, presença, cobranças e lembretes.</p>
      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável pelos dados que cadastra e por manter sua senha em segurança.</li>
        <li>Os alunos não acessam o app; você usa os dados deles apenas para gerir suas aulas.</li>
      </ul>
      <h2>Uso gratuito e assinatura</h2>
      <p>
        O uso é gratuito neste momento. Se no futuro houver assinatura, avisaremos com antecedência, com período de teste e a
        possibilidade de cancelar quando quiser.
      </p>
      <h2>Dados</h2>
      <p>Você pode exportar e excluir seus dados a qualquer momento em Mais → Meus dados.</p>
    </LegalPage>
  );
}
