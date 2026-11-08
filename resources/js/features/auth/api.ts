import { router } from '@inertiajs/react';
import forgotPasswordRoutes from '@/routes/forgot-password';
import loginRoutes from '@/routes/login';
import confirmPasswordRoutes from '@/routes/password/confirm';
import profileRoutes from '@/routes/profile';
import registerRoutes from '@/routes/register';
import resetPasswordRoutes from '@/routes/reset-password';
import twoFactorActionRoutes from '@/routes/two-factor';
import twoFactorLoginRoutes from '@/routes/two-factor/login';
import twoFactorChallengeRoutes from '@/routes/two-factor-challenge';
import verificationRoutes from '@/routes/verification';

type Errors = Record<string, string>;

type Callbacks = {
  onSuccess?: () => void;
  onError?: (errors: Errors) => void;
  onFinish?: () => void;
};

export function login(
  credentials: { email: string; password: string; remember: boolean },
  callbacks: Callbacks,
) {
  router.post(loginRoutes.store.url(), credentials, callbacks);
}

export function twoFactorChallenge(
  values: { code: string } | { recovery_code: string },
  callbacks: Callbacks,
) {
  router.post(twoFactorLoginRoutes.store.url(), values, callbacks);
}

export function confirmPassword(values: { password: string }, callbacks: Callbacks) {
  router.post(confirmPasswordRoutes.store.url(), values, callbacks);
}

export function enableTwoFactor(callbacks: Callbacks) {
  router.post(twoFactorActionRoutes.enable.url(), {}, callbacks);
}

export function confirmTwoFactor(values: { code: string }, callbacks: Callbacks) {
  router.post(twoFactorActionRoutes.confirm.url(), values, {
    ...callbacks,
    errorBag: 'confirmTwoFactorAuthentication',
  });
}

export function disableTwoFactor(callbacks: Callbacks) {
  router.delete(twoFactorActionRoutes.disable.url(), callbacks);
}

export function regenerateRecoveryCodes(callbacks: Callbacks) {
  router.post(twoFactorActionRoutes.regenerateRecoveryCodes.url(), {}, callbacks);
}

export function register(
  values: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    'cf-turnstile-response': string;
  },
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

export function deleteAccount(password: string, callbacks: Callbacks) {
  router.delete(profileRoutes.destroy.url(), { data: { password }, ...callbacks });
}

export function resendVerificationEmail(callbacks: Callbacks) {
  router.post(verificationRoutes.send.url(), {}, callbacks);
}

export function requestTwoFactorRecovery(values: { email: string }, callbacks: Callbacks) {
  router.post(twoFactorChallengeRoutes.recovery.url(), values, callbacks);
}
