export interface AccessTokenPayload {
  sub: string;
  sid: string;
  roles: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  type: "refresh";
  iat?: number;
  exp?: number;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}
