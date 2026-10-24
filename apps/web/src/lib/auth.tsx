'use client';

import { isMfaChallenge, type LoginRequest, type RegisterRequest, type TeacherDto } from '@turmei/contracts';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import * as authApi from './api/auth';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from './api/client';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  teacher: TeacherDto | null;
  /** Devolve o token de 2FA quando a conta exige o segundo passo. */
  login: (body: LoginRequest) => Promise<{ mfaToken?: string }>;
  completeMfa: (mfaToken: string, code: string) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  /** Recarrega os dados do professor (após confirmar e-mail, finalizar cadastro…). */
  reloadTeacher: () => Promise<void>;
  logout: () => Promise<void>;
  /** Atualiza os dados do professor em memória (após salvar ajustes). */
  setTeacher: (t: TeacherDto) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const PUBLIC_ENTRY = ['/login', '/login/2fa', '/cadastro', '/esqueci-senha', '/redefinir-senha'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>('loading');
  const [teacher, setTeacher] = React.useState<TeacherDto | null>(null);

  React.useEffect(() => {
    // Restaura a sessão a partir do cookie httpOnly de refresh. Nas telas de entrada o proxy já
    // garantiu que não há cookie, então não vale a requisição.
    const restore = PUBLIC_ENTRY.includes(window.location.pathname) ? Promise.resolve(null) : refreshSession();
    restore.then((session) => {
      setTeacher(session?.teacher ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
    });
    setSessionExpiredHandler(() => {
      setTeacher(null);
      setStatus('anonymous');
      router.replace('/login');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      teacher,
      login: async (body) => {
        const data = await authApi.login(body);
        if (isMfaChallenge(data)) return { mfaToken: data.mfaToken };
        setTeacher(data.teacher);
        setStatus('authenticated');
        return {};
      },
      completeMfa: async (mfaToken, code) => {
        const data = await authApi.verifyMfa(mfaToken, code);
        setTeacher(data.teacher);
        setStatus('authenticated');
      },
      register: async (body) => {
        const data = await authApi.register(body);
        setTeacher(data.teacher);
        setStatus('authenticated');
      },
      reloadTeacher: async () => {
        setTeacher(await authApi.getMe());
      },
      logout: async () => {
        await authApi.logout().catch(() => setAccessToken(null));
        setTeacher(null);
        setStatus('anonymous');
        router.replace('/login');
      },
      setTeacher,
    }),
    [status, teacher, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
