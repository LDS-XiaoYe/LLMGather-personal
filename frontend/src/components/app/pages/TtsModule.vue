<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';
import type { PageMode } from '../../../types';

const props = defineProps<{ app: Record<string, any> }>();
const app = props.app;
const bind = (target: Record<string, any>, key: string) => vueComputed({
  get: () => unref(target[key]),
  set: (value) => {
    if (isRef(target[key])) target[key].value = value;
    else target[key] = value;
  },
});

const SwitchButton = bind(app, 'SwitchButton');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const userInvitationCode = bind(app, 'userInvitationCode');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const isAuthenticated = bind(app, 'isAuthenticated');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const ttsText = bind(app, 'ttsText');
const ttsVoice = bind(app, 'ttsVoice');
const ttsStyleTag = bind(app, 'ttsStyleTag');
const ttsStyleInstruction = bind(app, 'ttsStyleInstruction');
const ttsSingingMode = bind(app, 'ttsSingingMode');
const ttsModeSegment = bind(app, 'ttsModeSegment');
const ttsAudioUrl = bind(app, 'ttsAudioUrl');
const ttsAudioLoading = bind(app, 'ttsAudioLoading');
const ttsError = bind(app, 'ttsError');
const ttsAudioRef = bind(app, 'ttsAudioRef');
const ttsHistory = bind(app, 'ttsHistory');
const ttsModel = bind(app, 'ttsModel');
const ttsModels = bind(app, 'ttsModels');
const TTS_STYLE_TAGS = bind(app, 'TTS_STYLE_TAGS');
const TTS_AUDIO_TAGS = bind(app, 'TTS_AUDIO_TAGS');
const TTS_VOICES = bind(app, 'TTS_VOICES');
const insertTtsTag = bind(app, 'insertTtsTag');
const onTtsModeChange = bind(app, 'onTtsModeChange');
const generateTts = bind(app, 'generateTts');
const copyToClipboard = bind(app, 'copyToClipboard');
</script>

<template>
        <div class="page-header">
          <div class="header-left" style="gap:8px"><strong>语音生成</strong>
            <el-select v-model="ttsModel" filterable placeholder="TTS模型" style="width:220px" size="small">
              <el-option v-for="m in ttsModels" :key="m.id" :label="m.id" :value="m.id" />
            </el-select>
          </div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
              <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
              <el-dropdown v-else trigger="click" @command="handleUserMenu">
                <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="userInvitationCode" disabled>
                      <span style="color:#666;">邀请码：{{ userInvitationCode }}</span>
                      <el-button size="small" style="margin-left:8px" @click.stop="copyToClipboard(userInvitationCode)">复制</el-button>
                    </el-dropdown-item>
                    <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </div>
        </div>

        <div class="tts-layout">
          <!-- Left: Controls -->
          <div class="tts-sidebar">
            <div class="tts-section">
              <div class="tts-section-title">音色</div>
              <el-radio-group v-model="ttsVoice" class="tts-voice-grid">
                <el-radio-button v-for="v in TTS_VOICES" :key="v.value" :value="v.value" :label="v.label" />
              </el-radio-group>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">模式</div>
              <el-segmented v-model="ttsModeSegment" :options="[
                { label: '朗读', value: 'read' },
                { label: '唱歌', value: 'sing' },
              ]" @change="onTtsModeChange" />
            </div>

            <div v-if="!ttsSingingMode" class="tts-section">
              <div class="tts-section-title">风格标签</div>
              <div class="tts-tag-grid">
                <div v-for="tag in TTS_STYLE_TAGS" :key="tag.value"
                  class="tts-tag-item" :class="{ active: ttsStyleTag === tag.value }"
                  @click="ttsStyleTag = ttsStyleTag === tag.value ? '' : tag.value">
                  {{ tag.label }}
                </div>
              </div>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">音频标签 <span style="font-weight:400;font-size:12px;color:#909399">点击插入文本</span></div>
              <div class="tts-tag-grid">
                <div v-for="tag in TTS_AUDIO_TAGS" :key="tag.value" class="tts-tag-item tts-audio-tag" @click="insertTtsTag(tag.value)">
                  [{{ tag.label }}]
                </div>
              </div>
            </div>

            <div class="tts-section">
              <div class="tts-section-title">风格指令 <span style="font-weight:400;font-size:12px;color:#909399">自然语言描述</span></div>
              <el-input v-model="ttsStyleInstruction" type="textarea" :rows="3" placeholder="如：用欢快明亮的语气，语速稍快" resize="vertical" />
            </div>
          </div>

          <!-- Right: Text + Output -->
          <div class="tts-main">
            <el-card shadow="never" class="tts-card">
              <el-input v-model="ttsText" type="textarea" :rows="8" resize="vertical"
                :placeholder="ttsSingingMode ? '输入歌词（中文效果更佳）...' : '输入要合成的文本...\n可在文本中插入 [叹气] [笑] 等音频标签'" />

              <div class="tts-actions">
                <div class="tts-status">
                  <el-text v-if="ttsStyleTag && !ttsSingingMode" type="info" size="small">风格：{{ ttsStyleTag }}</el-text>
                  <el-text v-if="ttsSingingMode" type="warning" size="small">唱歌模式</el-text>
                </div>
                <el-button type="primary" size="large" :loading="ttsAudioLoading" @click="generateTts()" :disabled="!ttsText.trim()">
                  {{ ttsAudioLoading ? '生成中...' : '生成语音' }}
                </el-button>
              </div>
            </el-card>

            <el-alert v-if="ttsError" type="error" :title="ttsError" :closable="false" show-icon style="margin-top:12px" />

            <el-card v-if="ttsAudioUrl" shadow="never" class="tts-card tts-player-card">
              <div class="tts-player">
                <audio ref="ttsAudioRef" :src="ttsAudioUrl" controls style="width:100%"></audio>
              </div>
            </el-card>

            <!-- History -->
            <div v-if="ttsHistory.length > 0" class="tts-history">
              <div class="tts-section-title" style="margin-bottom:8px">历史记录</div>
              <div v-for="(item, idx) in ttsHistory" :key="idx" class="tts-history-item">
                <div class="tts-history-info">
                  <el-text size="small" truncated style="max-width:400px">{{ item.text }}</el-text>
                  <el-tag size="small" type="info">{{ item.voice }}</el-tag>
                  <el-tag v-if="item.style" size="small">{{ item.style }}</el-tag>
                </div>
                <audio :src="item.url" controls style="width:100%;margin-top:4px"></audio>
              </div>
            </div>
          </div>
        </div>
</template>
