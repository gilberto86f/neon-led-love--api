export const authConfig = {
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
  accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "30m",
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  refreshTokenTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 30),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  passwordMinLength: 8,
};

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production",
    );
  }
}
