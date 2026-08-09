export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  timezone: string;
  roles: string[];
};
