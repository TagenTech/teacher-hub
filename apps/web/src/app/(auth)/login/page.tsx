import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <AuthLayout title="Turmei" subtitle="Suas aulas, alunos e mensalidades num só lugar 💜">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
