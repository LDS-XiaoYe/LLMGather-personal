<script setup lang="ts">
import { useAuth } from '../composables/useAuth';
import { backendBaseUrl } from '../composables/state';

const {
  isAuthDialogOpen, authMode, authUsername, authPassword,
  authEmail, authVerificationCode, authInvitationCode,
  authLoading, authError, userInvitationCode, codeCountdown,
  handleSendCode, submitAuth,
} = useAuth();

function onClosed() {
  authError.value = '';
}

function onSendCode() {
  handleSendCode(backendBaseUrl.value);
}
</script>

<template>
  <el-dialog v-model="isAuthDialogOpen" :close-on-click-modal="false" title="登录 / 注册" width="420px" @closed="onClosed">
    <el-form label-position="top" class="settings-body">
      <el-segmented
        v-model="authMode"
        :options="[
          { label: '登录', value: 'login' },
          { label: '注册', value: 'register' },
        ]"
      />
      <el-form-item label="用户名">
        <el-input v-model="authUsername" placeholder="输入用户名" />
      </el-form-item>
      <el-form-item v-if="authMode === 'register'" label="邮箱">
        <el-input v-model="authEmail" placeholder="输入邮箱地址" />
      </el-form-item>
      <el-form-item v-if="authMode === 'register'" label="验证码">
        <div style="display:flex;gap:8px;width:100%;">
          <el-input v-model="authVerificationCode" placeholder="输入6位验证码" maxlength="6" style="flex:1;" />
          <el-button
            :disabled="codeCountdown > 0 || !authEmail.trim()"
            @click="onSendCode"
            style="white-space:nowrap;"
          >
            {{ codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码' }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="authPassword" type="password" show-password placeholder="输入密码" @keyup.enter="submitAuth(backendBaseUrl)" />
      </el-form-item>
      <el-form-item v-if="authMode === 'register'" label="邀请码（选填）">
        <el-input v-model="authInvitationCode" placeholder="填写邀请码，双方都可获得额度" maxlength="6" />
      </el-form-item>
      <el-form-item v-if="authMode === 'login' && userInvitationCode" label="我的邀请码">
        <el-input :model-value="userInvitationCode" readonly>
          <template #append>
            <el-button @click="$copyText(userInvitationCode!)">复制</el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-alert v-if="authError" type="error" show-icon :closable="false" :title="authError" />
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="authLoading" @click="submitAuth(backendBaseUrl)">{{ authMode === 'register' ? '注册并登录' : '登录' }}</el-button>
    </template>
  </el-dialog>
</template>
