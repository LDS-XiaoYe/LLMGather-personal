export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  emailVerified?: boolean | number | string;
  role: string;
  credits: number;
  totalSpent: number;
  createdAt: string;
}

export interface AuthTokenPayload {
  sessionId?: string;
  version?: number;
  sub: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequestUser {
  id: string;
  username: string;
  role: string;
}

export interface StoredUser {
  authVersion?: number;
  id: string;
  username: string;
  email: string | null;
  emailVerified?: boolean | number | string;
  role: string;
  passwordHash: string;
  salt: string;
  credits: number;
  totalSpent: number;
  createdAt: string;
}
