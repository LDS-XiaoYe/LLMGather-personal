export interface BehaviorPayload {
  duration?: number;
  mouseMoveCount?: number;
  clickCount?: number;
  keydownCount?: number;
  focusCount?: number;
  blurCount?: number;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
  language?: string;
  userAgent?: string;
  webdriver?: boolean;
}

export interface RiskCheckInput {
  challengeId: string;
  behaviorPayload?: BehaviorPayload;
  captchaId?: string;
  captchaCode?: string;
}

export interface RiskCheckResult {
  allowed: boolean;
  captchaRequired: boolean;
  rejected: boolean;
  riskScore: number;
  reasons: string[];
}
