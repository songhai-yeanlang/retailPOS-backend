export type UserRole = 'owner' | 'manager' | 'cashier';

export interface AuthUser {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
}

export interface JwtTokenPayload {
  sub: number;
  username: string;
  role: UserRole;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
