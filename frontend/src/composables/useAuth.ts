import { ref, computed } from 'vue';
import {
  clearStoredToken,
  fetchInvitationCode,
  fetchMe,
  getStoredToken,
  login,
  logout as apiLogout,
  register,
  sendVerificationCode,
  setStoredToken,
} from '../api';
import { authUser, isAuthLoaded, isSessionLoaded } from './state';

const isAuthDialogOpen = ref(false);
const authMode = ref<'login' | 'register'>('login');
const authUsername = ref('');
const authPassword = ref('');
const authEmail = ref('');
const authVerificationCode = ref('');
const authInvitationCode = ref('');
const authLoading = ref(false);
const authError = ref('');
const userInvitationCode = ref<string | null>(null);

// Verification code countdown
const codeCountdown = ref(0);
let codeTimer: ReturnType<typeof setInterval> | null = null;

const isAuthenticated = computed(() => Boolean(authUser.value));
const authCreditsText = computed(() => (authUser.value ? Number(authUser.value.credits).toFixed(4) : '0.0000'));
const authSpentText = computed(() => (authUser.value ? Number(authUser.value.totalSpent).toFixed(4) : '0.0000'));

export function useAuth() {
  async function bootstrapAuth(baseUrl: string) {
    try {
      authUser.value = await fetchMe(baseUrl);
    } catch {
      if (getStoredToken()) {
        clearStoredToken();
      }
      authUser.value = null;
    } finally {
      isAuthLoaded.value = true;
    }
  }

  async function fetchUserInvitationCode(baseUrl: string) {
    try {
      userInvitationCode.value = await fetchInvitationCode(baseUrl);
    } catch {
      userInvitationCode.value = null;
    }
  }

  function startCountdown(seconds: number) {
    codeCountdown.value = seconds;
    if (codeTimer) clearInterval(codeTimer);
    codeTimer = setInterval(() => {
      codeCountdown.value--;
      if (codeCountdown.value <= 0) {
        codeCountdown.value = 0;
        if (codeTimer) { clearInterval(codeTimer); codeTimer = null; }
      }
    }, 1000);
  }

  async function handleSendCode(baseUrl: string) {
    authError.value = '';
    const email = authEmail.value.trim();
    if (!email) {
      authError.value = '请输入邮箱';
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      authError.value = '邮箱格式不正确';
      return;
    }

    try {
      await sendVerificationCode(email, baseUrl);
      startCountdown(60);
    } catch (error) {
      authError.value = error instanceof Error ? error.message : '发送验证码失败';
    }
  }

  async function submitAuth(baseUrl: string) {
    authError.value = '';
    const username = authUsername.value.trim();
    const password = authPassword.value;
    if (!username || !password) {
      authError.value = '请输入用户名和密码';
      return;
    }

    if (authMode.value === 'register') {
      const email = authEmail.value.trim();
      if (!email) {
        authError.value = '请输入邮箱';
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        authError.value = '邮箱格式不正确';
        return;
      }
      if (!authVerificationCode.value.trim()) {
        authError.value = '请输入验证码';
        return;
      }
    }

    authLoading.value = true;
    try {
      const invitationCode = authMode.value === 'register' ? authInvitationCode.value.trim() || undefined : undefined;
      const result = authMode.value === 'register'
        ? await register(username, password, authEmail.value.trim(), authVerificationCode.value.trim(), invitationCode, baseUrl)
        : await login(username, password, baseUrl);
      setStoredToken(result.accessToken);
      authUser.value = result.user;
      authPassword.value = '';
      authEmail.value = '';
      authVerificationCode.value = '';
      authInvitationCode.value = '';
      authError.value = '';
      authLoading.value = false;
      isAuthDialogOpen.value = false;
      if (authMode.value === 'register') {
        await fetchUserInvitationCode(baseUrl);
      }
    } catch (error) {
      authError.value = error instanceof Error ? error.message : '登录失败';
      authLoading.value = false;
    }
  }

  async function logout(baseUrl: string) {
    clearStoredToken();
    apiLogout(baseUrl).catch(() => {});
    authUser.value = null;
    userInvitationCode.value = null;
    isSessionLoaded.value = false;
    isAuthLoaded.value = true;
  }

  return {
    isAuthDialogOpen,
    authMode,
    authUsername,
    authPassword,
    authEmail,
    authVerificationCode,
    authInvitationCode,
    authLoading,
    authError,
    userInvitationCode,
    codeCountdown,
    isAuthenticated,
    authCreditsText,
    authSpentText,
    bootstrapAuth,
    fetchUserInvitationCode,
    handleSendCode,
    submitAuth,
    logout,
  };
}

export { authUser, isAuthLoaded, isAuthenticated };
