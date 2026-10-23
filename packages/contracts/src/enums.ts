/** Enums do domínio — compartilhados entre API e web. */

export const StudentStatus = {
  ATIVO: 'ATIVO',
  PAUSADO: 'PAUSADO',
  INATIVO: 'INATIVO',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const BillingPlanType = {
  MENSAL: 'MENSAL',
  POR_AULA: 'POR_AULA',
  PACOTE: 'PACOTE',
} as const;
export type BillingPlanType = (typeof BillingPlanType)[keyof typeof BillingPlanType];

export const LessonMode = {
  PRESENCIAL: 'PRESENCIAL',
  ONLINE: 'ONLINE',
} as const;
export type LessonMode = (typeof LessonMode)[keyof typeof LessonMode];

export const LessonStatus = {
  AGENDADA: 'AGENDADA',
  REALIZADA: 'REALIZADA',
  FALTA_ALUNO: 'FALTA_ALUNO',
  FALTA_PROFESSOR: 'FALTA_PROFESSOR',
  CANCELADA: 'CANCELADA',
  REMARCADA: 'REMARCADA',
} as const;
export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

export const ChargeKind = {
  MENSALIDADE: 'MENSALIDADE',
  AULAS_DO_MES: 'AULAS_DO_MES',
  PACOTE: 'PACOTE',
  AVULSA: 'AVULSA',
  AJUSTE: 'AJUSTE',
} as const;
export type ChargeKind = (typeof ChargeKind)[keyof typeof ChargeKind];

/** Status da cobrança — sempre calculado, nunca gravado. */
export const ChargeStatus = {
  PENDENTE: 'PENDENTE',
  PARCIAL: 'PARCIAL',
  PAGO: 'PAGO',
  ATRASADO: 'ATRASADO',
  CANCELADO: 'CANCELADO',
} as const;
export type ChargeStatus = (typeof ChargeStatus)[keyof typeof ChargeStatus];

export const PaymentMethod = {
  PIX: 'PIX',
  DINHEIRO: 'DINHEIRO',
  CARTAO: 'CARTAO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  OUTRO: 'OUTRO',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PixKeyType = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'EMAIL',
  TELEFONE: 'TELEFONE',
  ALEATORIA: 'ALEATORIA',
} as const;
export type PixKeyType = (typeof PixKeyType)[keyof typeof PixKeyType];

export const MakeupCreditStatus = {
  ABERTO: 'ABERTO',
  USADO: 'USADO',
  CANCELADO: 'CANCELADO',
} as const;
export type MakeupCreditStatus = (typeof MakeupCreditStatus)[keyof typeof MakeupCreditStatus];

export const NotificationType = {
  AULA: 'AULA',
  RESUMO_DIARIO: 'RESUMO_DIARIO',
  PAGAMENTO_D1: 'PAGAMENTO_D1',
  PAGAMENTO_ATRASO: 'PAGAMENTO_ATRASO',
  ANIVERSARIO: 'ANIVERSARIO',
  PACOTE_ACABANDO: 'PACOTE_ACABANDO',
  TESTE: 'TESTE',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
