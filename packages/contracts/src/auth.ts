import type { PixKeyType } from './enums';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const AuthProvider = {
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
  FACEBOOK: 'facebook',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const AUTH_PROVIDER_LABEL: Record<AuthProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft (Outlook)',
  facebook: 'Facebook (Meta)',
};

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

/** Provedores de login social habilitados no servidor (os sem credencial ficam ocultos). */
export interface AuthProvidersDto {
  providers: AuthProvider[];
  /** Cadastro público aberto? (pode ser fechado por variável de ambiente). */
  signupEnabled: boolean;
}

export interface CompleteProfileRequest {
  name: string;
  cpf: string;
  phone: string;
  city?: string | null;
  state?: string | null;
}

export interface TeacherDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** CPF mascarado (***.456.789-**); o número completo nunca volta para o navegador. */
  cpfMasked: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  /** Finalizou o cadastro (nome, CPF e celular)? */
  profileComplete: boolean;
  hasPassword: boolean;
  providers: AuthProvider[];
  /** Verificação em duas etapas ativa? */
  mfaEnabled: boolean;
  timezone: string;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  lessonReminderMinutes: number;
  paymentReminderHour: number;
  defaultLessonMinutes: number;
  whatsappTemplate: string | null;
}

export interface UpdateSettingsRequest {
  name?: string;
  pixKey?: string | null;
  pixKeyType?: PixKeyType | null;
  lessonReminderMinutes?: number;
  paymentReminderHour?: number;
  defaultLessonMinutes?: number;
  whatsappTemplate?: string | null;
}

export const LESSON_REMINDER_OPTIONS = [0, 10, 15, 30, 60, 120] as const;
export const LESSON_DURATION_OPTIONS = [30, 45, 50, 60, 90, 120] as const;

/** Resposta de login/refresh. O refresh token vai em cookie httpOnly, nunca no corpo. */
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  teacher: TeacherDto;
}

export interface ApiError {
  statusCode: number;
  message: string;
  details?: string[];
}

export const PASSWORD_MIN_LENGTH = 8;

/** Login com senha/social quando a conta tem 2FA: falta o código do app autenticador. */
export interface MfaChallenge {
  mfaRequired: true;
  /** Token de 5 min, uso único, que só serve para /auth/mfa/verify. */
  mfaToken: string;
}

export type LoginResult = AuthResponse | MfaChallenge;

export const isMfaChallenge = (r: LoginResult): r is MfaChallenge => 'mfaRequired' in r;

export interface MfaVerifyRequest {
  mfaToken: string;
  /** Código de 6 dígitos do app ou um código de recuperação (XXXX-XXXX). */
  code: string;
}

export interface MfaSetupDto {
  /** Chave em base32 para digitar no app, caso não dê para ler o QR. */
  secret: string;
  otpauthUrl: string;
}

export interface MfaCodeRequest {
  code: string;
}

export interface RecoveryCodesDto {
  codes: string[];
}

export interface SessionDto {
  id: string;
  device: string;
  ip: string | null;
  lastActiveAt: string;
  startedAt: string;
  current: boolean;
}

export const SecurityEventType = {
  LOGIN_OK: 'LOGIN_OK',
  LOGIN_FAIL: 'LOGIN_FAIL',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  LOGOUT: 'LOGOUT',
  SIGNUP: 'SIGNUP',
  OAUTH_CREATED: 'OAUTH_CREATED',
  OAUTH_LINKED: 'OAUTH_LINKED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  TOKEN_REUSE: 'TOKEN_REUSE',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_FAIL: 'MFA_FAIL',
  RECOVERY_CODE_USED: 'RECOVERY_CODE_USED',
  PROFILE_COMPLETED: 'PROFILE_COMPLETED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
} as const;
export type SecurityEventType = (typeof SecurityEventType)[keyof typeof SecurityEventType];

export const SECURITY_EVENT_LABEL: Record<SecurityEventType, string> = {
  LOGIN_OK: 'Entrou na conta',
  LOGIN_FAIL: 'Senha errada',
  LOGIN_LOCKED: 'Login bloqueado por tentativas',
  LOGOUT: 'Saiu da conta',
  SIGNUP: 'Conta criada',
  OAUTH_CREATED: 'Conta criada com login social',
  OAUTH_LINKED: 'Login social conectado',
  PASSWORD_CHANGED: 'Senha alterada',
  PASSWORD_RESET_REQUESTED: 'Pediu para redefinir a senha',
  PASSWORD_RESET: 'Senha redefinida pelo e-mail',
  EMAIL_VERIFIED: 'E-mail confirmado',
  SESSION_REVOKED: 'Sessão encerrada',
  TOKEN_REUSE: 'Uso suspeito de sessão — todas encerradas',
  MFA_ENABLED: 'Verificação em duas etapas ativada',
  MFA_DISABLED: 'Verificação em duas etapas desativada',
  MFA_FAIL: 'Código de verificação errado',
  RECOVERY_CODE_USED: 'Código de recuperação usado',
  PROFILE_COMPLETED: 'Cadastro finalizado',
  ACCOUNT_DELETED: 'Conta excluída',
};

export interface SecurityEventDto {
  id: string;
  type: SecurityEventType;
  device: string;
  ip: string | null;
  createdAt: string;
}

export interface DeleteAccountRequest {
  /** Digite o próprio e-mail para confirmar. */
  confirmEmail: string;
  /** Obrigatória se a conta tem senha. */
  password?: string;
  /** Obrigatório se a conta tem 2FA. */
  code?: string;
}

/** Nome amigável do aparelho a partir do User-Agent: "iPhone · Safari". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Aparelho';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return browser ? `${os} · ${browser}` : os;
}
