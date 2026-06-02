export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  credits: number;
  totalSpent: number;
  createdAt: string;
}

export interface AuthTokenPayload {
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
  id: string;
  username: string;
  email: string | null;
  role: string;
  passwordHash: string;
  salt: string;
  credits: number;
  totalSpent: number;
  createdAt: string;
}
