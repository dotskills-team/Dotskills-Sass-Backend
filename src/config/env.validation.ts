type Environment = Record<string, unknown>;

const requiredSecrets = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;

export function validateEnvironment(config: Environment): Environment {
  for (const key of requiredSecrets) {
    const value = String(config[key] ?? "");

    if (value.length < 32) {
      throw new Error(`${key} must contain at least 32 characters`);
    }
  }

  const positiveIntegers = [
    "JWT_ACCESS_TTL_SECONDS",
    "JWT_REFRESH_TTL_SECONDS",
    "AUTH_MAX_FAILED_ATTEMPTS",
    "AUTH_LOCK_MINUTES",
  ] as const;

  for (const key of positiveIntegers) {
    const value = Number(config[key]);

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
  }

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error("Access and refresh token secrets must be different");
  }

  return config;
}
