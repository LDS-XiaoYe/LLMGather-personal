<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from "vue";
import type { PageMode } from "../../../types";

const props = defineProps<{ app: Record<string, any> }>();
const app = props.app;
const bind = (target: Record<string, any>, key: string) =>
  vueComputed({
    get: () => unref(target[key]),
    set: (value) => {
      if (isRef(target[key])) target[key].value = value;
      else target[key] = value;
    },
  });

const Cpu = bind(app, "Cpu");
const ChatDotRound = bind(app, "ChatDotRound");
const DataAnalysis = bind(app, "DataAnalysis");
const Delete = bind(app, "Delete");
const PictureFilled = bind(app, "PictureFilled");
const Promotion = bind(app, "Promotion");
const Search = bind(app, "Search");
const SwitchButton = bind(app, "SwitchButton");
const User = bind(app, "User");
const VideoCamera = bind(app, "VideoCamera");
const renderMarkdown = bind(app, "renderMarkdown");
const isAuthDialogOpen = bind(app, "isAuthDialogOpen");
const authUser = bind(app, "authUser");
const userInvitationCode = bind(app, "userInvitationCode");
const isAuthLoaded = bind(app, "isAuthLoaded");
const isComposing = bind(app, "isComposing");
const isAuthenticated = bind(app, "isAuthenticated");
const handleUserMenu = bind(app, "handleUserMenu");
const logout = bind(app, "logout");
const visionModels = bind(app, "visionModels");
const multimodalTab = bind(app, "multimodalTab");
const videoFile = bind(app, "videoFile");
const videoUrl = bind(app, "videoUrl");
const videoAnalysis = bind(app, "videoAnalysis");
const videoAnalysisRunning = bind(app, "videoAnalysisRunning");
const videoRef = bind(app, "videoRef");
const drivingCanvasRef = bind(app, "drivingCanvasRef");
const drivingRunning = bind(app, "drivingRunning");
const drivingSpeed = bind(app, "drivingSpeed");
const drivingSteering = bind(app, "drivingSteering");
const drivingAutoPilot = bind(app, "drivingAutoPilot");
const drivingStats = bind(app, "drivingStats");
const drivingScenario = bind(app, "drivingScenario");
const drivingWeather = bind(app, "drivingWeather");
const drivingControlMode = bind(app, "drivingControlMode");
const drivingOpenPilotMode = bind(app, "drivingOpenPilotMode");
const drivingScenarioOptions = bind(app, "drivingScenarioOptions");
const drivingControlModeOptions = bind(app, "drivingControlModeOptions");
const drivingPerception = bind(app, "drivingPerception");
const drivingOpenPilotState = bind(app, "drivingOpenPilotState");
const retrievalQuery = bind(app, "retrievalQuery");
const retrievalResults = bind(app, "retrievalResults");
const retrievalLoading = bind(app, "retrievalLoading");
const mmChatMessages = bind(app, "mmChatMessages");
const mmChatPrompt = bind(app, "mmChatPrompt");
const mmChatImages = bind(app, "mmChatImages");
const mmChatAudioBase64 = bind(app, "mmChatAudioBase64");
const mmChatAudioName = bind(app, "mmChatAudioName");
const mmChatVideoUrl = bind(app, "mmChatVideoUrl");
const mmChatVideoName = bind(app, "mmChatVideoName");
const mmChatMediaType = bind(app, "mmChatMediaType");
const mmChatFileRef = bind(app, "mmChatFileRef");
const mmChatAudioRef = bind(app, "mmChatAudioRef");
const mmChatVideoRef = bind(app, "mmChatVideoRef");
const isMmChatSubmitting = bind(app, "isMmChatSubmitting");
const drivingAiAnalyzing = bind(app, "drivingAiAnalyzing");
const drivingAiAnalysis = bind(app, "drivingAiAnalysis");
const drivingAiIntervalSec = bind(app, "drivingAiIntervalSec");
const multimodalModel = bind(app, "multimodalModel");
const openImageInNewTab = bind(app, "openImageInNewTab");
const startDrivingSim = bind(app, "startDrivingSim");
const stopDrivingSim = bind(app, "stopDrivingSim");
const handleVideoUpload = bind(app, "handleVideoUpload");
const runVideoAnalysis = bind(app, "runVideoAnalysis");
const stopVideoAnalysis = bind(app, "stopVideoAnalysis");
const searchImages = bind(app, "searchImages");
const handleMmImageUpload = bind(app, "handleMmImageUpload");
const handleMmAudioUpload = bind(app, "handleMmAudioUpload");
const handleMmVideoUpload = bind(app, "handleMmVideoUpload");
const removeMmMedia = bind(app, "removeMmMedia");
const submitMmChat = bind(app, "submitMmChat");
const stopMmChat = bind(app, "stopMmChat");
const clearMmChat = bind(app, "clearMmChat");
const analyzeDrivingScene = bind(app, "analyzeDrivingScene");
const stopDrivingAnalysis = bind(app, "stopDrivingAnalysis");
const copyToClipboard = bind(app, "copyToClipboard");
const openVideoUploadInput = bind(app, "openVideoUploadInput");
</script>

<template>
  <div class="page-header">
    <div class="header-left" style="gap: 8px">
      <strong>全模态 Beta</strong>
      <el-select
        v-model="multimodalModel"
        filterable
        placeholder="视觉模型"
        style="width: 200px"
        size="small"
      >
        <el-option
          v-for="m in visionModels"
          :key="m.id"
          :label="m.id"
          :value="m.id"
        />
      </el-select>
    </div>
    <div class="header-right">
      <template v-if="isAuthLoaded">
        <el-button
          v-if="!isAuthenticated"
          type="primary"
          plain
          @click="isAuthDialogOpen = true"
          >登录 / 注册</el-button
        >
        <el-dropdown v-else trigger="click" @command="handleUserMenu">
          <el-tag type="success" style="cursor: pointer"
            >{{ authUser?.username }} ▾</el-tag
          >
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="console"
                ><el-icon><DataAnalysis /></el-icon> 控制台</el-dropdown-item
              >
              <el-dropdown-item v-if="userInvitationCode" disabled>
                <span style="color: #666"
                  >邀请码：{{ userInvitationCode }}</span
                >
                <el-button
                  size="small"
                  style="margin-left: 8px"
                  @click.stop="copyToClipboard(userInvitationCode)"
                  >复制</el-button
                >
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided
                ><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </div>
  </div>

  <div class="multimodal-page">
    <el-tabs v-model="multimodalTab" type="border-card" class="mm-tabs">
      <!-- ====== Tab 1: Autonomous Driving Simulation ====== -->
      <el-tab-pane label="自动驾驶模拟" name="driving">
        <div class="driving-layout">
          <div class="driving-main">
            <div class="driving-canvas-wrap">
              <canvas ref="drivingCanvasRef" class="driving-canvas" />
              <div v-if="!drivingRunning" class="driving-overlay">
                <el-icon :size="48" color="#fff"><VideoCamera /></el-icon>
                <span>点击下方「启动仿真」开始</span>
              </div>
            </div>
            <div class="driving-hud">
              <div class="hud-item">
                <span class="hud-label">速度</span>
                <span class="hud-value" style="color: #3b82f6"
                  >{{ Math.round(drivingSpeed) }} <small>km/h</small></span
                >
              </div>
              <div class="hud-item">
                <span class="hud-label">FPS</span>
                <span class="hud-value" style="color: #22c55e">{{
                  drivingStats.fps
                }}</span>
              </div>
              <div class="hud-item">
                <span class="hud-label">检测目标</span>
                <span class="hud-value" style="color: #f59e0b">{{
                  drivingStats.objects
                }}</span>
              </div>
              <div class="hud-item">
                <span class="hud-label">车道偏离</span>
                <span
                  class="hud-value"
                  :style="{
                    color:
                      Math.abs(drivingStats.laneDev) > 30
                        ? '#ef4444'
                        : '#8b5cf6',
                  }"
                  >{{ drivingStats.laneDev }} <small>px</small></span
                >
              </div>
              <div class="hud-item">
                <span class="hud-label">前车距离</span>
                <span
                  class="hud-value"
                  :style="{ color: drivingStats.fcw ? '#ef4444' : '#14b8a6' }"
                  >{{
                    drivingStats.leadDistance >= 999
                      ? "∞"
                      : drivingStats.leadDistance
                  }}
                  <small>m</small></span
                >
              </div>
              <div class="hud-item">
                <span class="hud-label">TTC</span>
                <span
                  class="hud-value"
                  :style="{
                    color:
                      drivingStats.ttc < 3
                        ? '#ef4444'
                        : drivingStats.ttc < 5
                          ? '#f59e0b'
                          : '#22c55e',
                  }"
                  >{{ drivingStats.ttc >= 99 ? "∞" : drivingStats.ttc }}
                  <small>s</small></span
                >
              </div>
            </div>
          </div>
          <div class="driving-panel">
            <el-card shadow="never" class="driving-card">
              <template #header>
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                  "
                >
                  <strong>仿真控制</strong>
                  <el-tag size="small" type="success">激进 openpilot</el-tag>
                </div>
              </template>
              <div class="driving-controls">
                <div class="control-row">
                  <span>OpenPilot 场景</span>
                  <el-select
                    v-model="drivingScenario"
                    style="width: 100%"
                    :disabled="drivingRunning"
                  >
                    <el-option
                      v-for="item in drivingScenarioOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
                <div class="control-row">
                  <span>天气/能见度</span>
                  <el-segmented
                    v-model="drivingWeather"
                    :options="[
                      { label: '晴', value: 'clear' },
                      { label: '雨', value: 'rain' },
                      { label: '雾', value: 'fog' },
                      { label: '夜', value: 'night' },
                    ]"
                  />
                </div>
                <div class="control-row">
                  <span>速度 (km/h)</span>
                  <el-slider
                    v-model="drivingSpeed"
                    :min="0"
                    :max="150"
                    :step="5"
                    show-input
                    :disabled="!drivingRunning"
                  />
                </div>
                <div class="control-row">
                  <span>转向</span>
                  <el-slider
                    v-model="drivingSteering"
                    :min="-1"
                    :max="1"
                    :step="0.05"
                    show-input
                    :disabled="drivingAutoPilot"
                  />
                </div>
                <div class="control-row">
                  <span>自动驾驶</span>
                  <el-switch v-model="drivingAutoPilot" />
                </div>
                <div class="control-row">
                  <span>控制模式</span>
                  <el-radio-group
                    v-model="drivingControlMode"
                    class="driving-mode-group"
                  >
                    <el-radio-button
                      v-for="item in drivingControlModeOptions"
                      :key="item.value"
                      :label="item.value"
                    >
                      {{ item.label }}
                    </el-radio-button>
                  </el-radio-group>
                </div>
                <div class="control-row">
                  <span>AI 分析间隔 ({{ drivingAiIntervalSec }}秒)</span>
                  <el-slider
                    v-model="drivingAiIntervalSec"
                    :min="1"
                    :max="10"
                    :step="1"
                    show-input
                  />
                </div>
                <div class="driving-model-card">
                  <span>当前分析模型</span>
                  <strong>{{ multimodalModel || "未选择" }}</strong>
                </div>
                <div class="driving-perception-card" :class="drivingStats.risk">
                  <strong>{{ drivingPerception.alert }}</strong>
                  <span
                    >Lane confidence {{ drivingPerception.laneConfidence }} ·
                    Lead {{ drivingPerception.leadDistance }}m · TTC
                    {{ drivingPerception.ttc }}s</span
                  >
                </div>
                <div class="openpilot-state-grid">
                  <div>
                    <span>LongControl</span
                    ><strong>{{ drivingOpenPilotState.longState }}</strong>
                  </div>
                  <div>
                    <span>LaneChange</span
                    ><strong>{{
                      drivingOpenPilotState.laneChangeState
                    }}</strong>
                  </div>
                  <div>
                    <span>Accel</span
                    ><strong
                      >{{ drivingOpenPilotState.outputAccel }} m/s²</strong
                    >
                  </div>
                  <div>
                    <span>Lat PID</span
                    ><strong>{{ drivingOpenPilotState.steerPid }}</strong>
                  </div>
                </div>
                <div class="control-actions">
                  <el-button
                    v-if="!drivingRunning"
                    type="primary"
                    :icon="VideoCamera"
                    @click="startDrivingSim()"
                    >启动仿真</el-button
                  >
                  <el-button
                    v-else
                    type="danger"
                    :icon="SwitchButton"
                    @click="stopDrivingSim()"
                    >停止仿真</el-button
                  >
                </div>
              </div>
            </el-card>
            <el-card shadow="never" class="driving-card">
              <template #header>
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                  "
                >
                  <strong>AI 场景分析</strong>
                  <el-button
                    v-if="drivingRunning && !drivingAiAnalyzing"
                    size="small"
                    type="primary"
                    :disabled="drivingControlMode === 'openpilot'"
                    @click="analyzeDrivingScene()"
                  >
                    分析当前场景
                  </el-button>
                  <el-button
                    v-if="drivingAiAnalyzing"
                    size="small"
                    type="danger"
                    @click="stopDrivingAnalysis()"
                    >停止</el-button
                  >
                </div>
              </template>
              <div class="driving-analysis">
                <div
                  v-if="!drivingAiAnalysis && !drivingAiAnalyzing"
                  style="
                    color: #909399;
                    font-size: 13px;
                    text-align: center;
                    padding: 20px 0;
                  "
                >
                  {{
                    drivingControlMode === "openpilot"
                      ? "纯 openpilot 模式不调用视觉模型"
                      : "点击「分析当前场景」调用视觉模型分析驾驶画面"
                  }}
                </div>
                <div
                  v-else-if="drivingAiAnalyzing && !drivingAiAnalysis"
                  style="
                    color: #909399;
                    font-size: 13px;
                    text-align: center;
                    padding: 20px 0;
                  "
                >
                  正在调用视觉模型分析驾驶场景...
                </div>
                <pre v-else class="driving-decision-output">{{
                  drivingAiAnalysis
                }}</pre>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ====== Tab 2: Video Understanding ====== -->
      <el-tab-pane label="视频理解" name="video">
        <div class="video-layout">
          <div class="video-player-section">
            <el-card shadow="never">
              <template #header><strong>视频播放</strong></template>
              <div
                v-if="!videoUrl"
                class="video-upload-area"
                @click="openVideoUploadInput()"
              >
                <el-icon :size="48" color="#c0c4cc"><VideoCamera /></el-icon>
                <p>点击上传视频文件 (MP4, WebM)</p>
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  style="display: none"
                  @change="handleVideoUpload"
                />
              </div>
              <div v-else class="video-player-wrap">
                <video
                  ref="videoRef"
                  :src="videoUrl"
                  controls
                  style="width: 100%; max-height: 360px; border-radius: 8px"
                />
                <div style="margin-top: 8px; display: flex; gap: 8px">
                  <el-button
                    size="small"
                    @click="
                      videoUrl = '';
                      videoFile = null;
                      videoAnalysis = [];
                    "
                    >清除</el-button
                  >
                  <el-button
                    v-if="!videoAnalysisRunning"
                    size="small"
                    type="primary"
                    @click="runVideoAnalysis()"
                    >开始分析</el-button
                  >
                  <el-button
                    v-else
                    size="small"
                    type="danger"
                    @click="stopVideoAnalysis()"
                    >停止分析</el-button
                  >
                </div>
              </div>
            </el-card>
          </div>
          <div class="video-results-section">
            <el-card shadow="never">
              <template #header>
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                  "
                >
                  <strong>分析结果</strong>
                  <el-tag
                    v-if="videoAnalysisRunning"
                    size="small"
                    type="warning"
                    >分析中...</el-tag
                  >
                </div>
              </template>
              <div
                v-if="videoAnalysis.length === 0"
                style="
                  color: #909399;
                  font-size: 13px;
                  text-align: center;
                  padding: 40px 0;
                "
              >
                <el-icon :size="36"><DataAnalysis /></el-icon>
                <p>尚未进行分析，请先上传视频并点击"开始分析"</p>
              </div>
              <el-scrollbar v-else max-height="360px">
                <div
                  v-for="(item, idx) in videoAnalysis"
                  :key="idx"
                  class="video-result-item"
                >
                  <div class="vr-header">
                    <span class="vr-time">{{ item.time.toFixed(1) }}s</span>
                    <el-tag
                      size="small"
                      :type="item.confidence > 0.85 ? 'success' : 'warning'"
                      >{{ item.label }}</el-tag
                    >
                    <span class="vr-conf"
                      >{{ (item.confidence * 100).toFixed(0) }}%</span
                    >
                  </div>
                  <div v-if="item.bbox" class="vr-bbox">
                    bbox: [{{ item.bbox.map((v) => Math.round(v)).join(", ") }}]
                  </div>
                </div>
              </el-scrollbar>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ====== Tab 3: Image-Text Retrieval ====== -->
      <el-tab-pane label="图文检索" name="retrieval">
        <div class="retrieval-section">
          <div class="retrieval-search">
            <el-input
              v-model="retrievalQuery"
              placeholder="输入检索关键词，如：城市交通、自动驾驶场景、道路标识..."
              size="large"
              @keyup.enter="searchImages()"
            >
              <template #append>
                <el-button
                  :icon="Search"
                  :loading="retrievalLoading"
                  @click="searchImages()"
                  >检索</el-button
                >
              </template>
            </el-input>
          </div>
          <div
            v-if="retrievalResults.length === 0 && !retrievalLoading"
            class="retrieval-empty"
          >
            <el-empty description="输入关键词开始图文检索" :image-size="96">
              <template #image>
                <el-icon :size="44" style="color: #8b5cf6"
                  ><PictureFilled
                /></el-icon>
              </template>
            </el-empty>
          </div>
          <div v-else class="retrieval-grid">
            <el-card
              v-for="item in retrievalResults"
              :key="item.id"
              shadow="hover"
              class="retrieval-card"
              body-style="padding:0"
            >
              <img
                :src="item.url"
                :alt="item.title"
                style="
                  width: 100%;
                  height: 140px;
                  object-fit: cover;
                  border-radius: 4px 4px 0 0;
                "
                loading="lazy"
              />
              <div class="retrieval-info">
                <div class="retrieval-title">{{ item.title }}</div>
                <div class="retrieval-sim">
                  <el-progress
                    :percentage="item.sim"
                    :color="
                      item.sim > 80
                        ? '#22c55e'
                        : item.sim > 60
                          ? '#f59e0b'
                          : '#ef4444'
                    "
                    :stroke-width="6"
                  />
                  <span style="font-size: 11px; color: #909399"
                    >相似度 {{ item.sim }}%</span
                  >
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ====== Tab 4: Multimodal Chat ====== -->
      <el-tab-pane label="多模态对话" name="chat">
        <div style="display: flex; flex-direction: column; height: 100%">
          <div class="thread" style="flex: 1">
            <div v-if="mmChatMessages.length === 0" class="group-empty">
              <el-empty
                description="上传图片/音频/视频并提问，体验真正的多模态对话。"
                :image-size="96"
              >
                <template #image>
                  <el-icon :size="44" style="color: #8b5cf6"
                    ><ChatDotRound
                  /></el-icon>
                </template>
              </el-empty>
            </div>
            <template v-for="msg in mmChatMessages" :key="msg.id">
              <div
                class="chat-bubble"
                :class="msg.role === 'user' ? 'is-user' : ''"
              >
                <el-avatar
                  :size="36"
                  :icon="msg.role === 'user' ? User : Cpu"
                  :style="{
                    backgroundColor:
                      msg.role === 'user' ? '#1677ff' : '#8b5cf6',
                    flexShrink: 0,
                  }"
                />
                <div class="bubble-body">
                  <div class="bubble-name">
                    {{ msg.role === "user" ? "你" : "多模态助手" }}
                  </div>
                  <!-- User media attachments -->
                  <div
                    v-if="msg.role === 'user' && msg.image"
                    style="margin-bottom: 8px"
                  >
                    <img
                      :src="msg.image"
                      style="
                        max-width: 260px;
                        max-height: 180px;
                        border-radius: 8px;
                        cursor: pointer;
                      "
                      @click="openImageInNewTab(msg.image)"
                    />
                  </div>
                  <div
                    v-if="msg.role === 'user' && msg.audio"
                    style="margin-bottom: 8px"
                  >
                    <audio
                      :src="msg.audio"
                      controls
                      style="max-width: 260px; height: 36px"
                    />
                  </div>
                  <div
                    v-if="msg.role === 'user' && msg.video"
                    style="margin-bottom: 8px"
                  >
                    <video
                      :src="msg.video"
                      controls
                      style="
                        max-width: 260px;
                        max-height: 160px;
                        border-radius: 8px;
                      "
                    />
                  </div>
                  <div
                    v-if="msg.role === 'assistant'"
                    class="markdown-content"
                    v-html="
                      renderMarkdown(
                        msg.content ||
                          (isMmChatSubmitting ? '正在分析...' : ''),
                      )
                    "
                  ></div>
                  <p v-else>{{ msg.content }}</p>
                </div>
              </div>
            </template>
          </div>
          <div class="composer">
            <el-card class="composer-card" shadow="never">
              <!-- Image previews (multi-image support) -->
              <div
                v-if="mmChatImages.length > 0"
                style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  flex-wrap: wrap;
                "
              >
                <div
                  v-for="(img, idx) in mmChatImages"
                  :key="idx"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: #f1f5f9;
                    border-radius: 6px;
                    padding: 4px 8px;
                  "
                >
                  <img
                    :src="img.base64"
                    style="height: 32px; border-radius: 4px"
                  />
                  <span
                    style="
                      font-size: 11px;
                      color: #606266;
                      max-width: 100px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    "
                    >{{ img.name }}</span
                  >
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click="removeMmMedia(idx)"
                    style="padding: 0 4px"
                    >✕</el-button
                  >
                </div>
              </div>
              <!-- Audio preview -->
              <div
                v-if="mmChatAudioBase64 && mmChatMediaType === 'audio'"
                style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                "
              >
                <el-tag type="success" size="small">🎵 音频</el-tag>
                <span style="font-size: 12px; color: #909399">{{
                  mmChatAudioName
                }}</span>
                <el-button
                  size="small"
                  text
                  type="danger"
                  @click="removeMmMedia()"
                  >移除</el-button
                >
              </div>
              <!-- Video preview -->
              <div
                v-if="mmChatVideoUrl && mmChatMediaType === 'video'"
                style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                "
              >
                <el-tag type="warning" size="small">🎬 视频</el-tag>
                <span style="font-size: 12px; color: #909399">{{
                  mmChatVideoName
                }}</span>
                <el-button
                  size="small"
                  text
                  type="danger"
                  @click="removeMmMedia()"
                  >移除</el-button
                >
              </div>
              <div style="display: flex; gap: 8px">
                <el-input
                  v-model="mmChatPrompt"
                  type="textarea"
                  :rows="2"
                  resize="vertical"
                  placeholder="输入问题，支持图片、音频、视频多模态对话..."
                  @keydown.enter.exact.prevent="submitMmChat()"
                  @compositionstart="isComposing = true"
                  @compositionend="isComposing = false"
                  style="flex: 1"
                  :disabled="isMmChatSubmitting"
                />
              </div>
              <div class="composer-bar">
                <div class="composer-meta" style="display: flex; gap: 6px">
                  <el-button size="small" @click="mmChatFileRef?.click()"
                    >📷 图片</el-button
                  >
                  <input
                    :ref="
                      (el: any) => {
                        mmChatFileRef = el;
                      }
                    "
                    type="file"
                    accept="image/*"
                    style="display: none"
                    @change="handleMmImageUpload"
                  />
                  <el-button size="small" @click="mmChatAudioRef?.click()"
                    >🎵 音频</el-button
                  >
                  <input
                    :ref="
                      (el: any) => {
                        mmChatAudioRef = el;
                      }
                    "
                    type="file"
                    accept="audio/*"
                    style="display: none"
                    @change="handleMmAudioUpload"
                  />
                  <el-button size="small" @click="mmChatVideoRef?.click()"
                    >🎬 视频</el-button
                  >
                  <input
                    :ref="
                      (el: any) => {
                        mmChatVideoRef = el;
                      }
                    "
                    type="file"
                    accept="video/*"
                    style="display: none"
                    @change="handleMmVideoUpload"
                  />
                </div>
                <div class="composer-actions">
                  <el-button :icon="Delete" @click="clearMmChat()"
                    >清空</el-button
                  >
                  <el-button
                    v-if="isMmChatSubmitting"
                    type="danger"
                    :icon="SwitchButton"
                    @click="stopMmChat()"
                    >停止</el-button
                  >
                  <el-button
                    v-else
                    type="primary"
                    :icon="Promotion"
                    @click="submitMmChat()"
                    :disabled="!mmChatPrompt.trim() || isMmChatSubmitting"
                    >{{ "发送" }}</el-button
                  >
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
