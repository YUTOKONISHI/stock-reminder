import { router } from '@inertiajs/react';
import forgotPasswordRoutes from '@/routes/forgot-password';
import loginRoutes from '@/routes/login';
import profileRoutes from '@/routes/profile';
import registerRoutes from '@/routes/register';
import resetPasswordRoutes from '@/routes/reset-password';

type Errors = Record<string, string>;

type Callbacks = {
  onSuccess?: () => void;
  onError?: (errors: Errors) => void;
};

export function login(credentials: { email: string; password: string }, callbacks: Callbacks) {
  router.post(loginRoutes.store.url(), credentials, callbacks);
}

export function register(
  values: { name: string; email: string; password: string; password_confirmation: string },
  callbacks: Callbacks,
) {
  router.post(registerRoutes.store.url(), values, callbacks);
}

export function requestPasswordReset(email: string, callbacks: Callbacks) {
  router.post(forgotPasswordRoutes.store.url(), { email }, callbacks);
}

export function resetPassword(
  values: {
    email: string;
    temporary_password: string;
    password: string;
    password_confirmation: string;
  },
  callbacks: Callbacks,
) {
  router.post(resetPasswordRoutes.store.url(), values, callbacks);
}

export function deleteAccount(password: string, callbacks: Callbacks & { onFinish?: () => void }) {
  router.delete(profileRoutes.destroy.url(), { data: { password }, ...callbacks });
}
