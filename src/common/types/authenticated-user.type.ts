export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
  platformMemberId?: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  timezone: string;
  roles: string[];
};
