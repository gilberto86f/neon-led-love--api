import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";
import { authConfig } from "../utils/authConfig";
import { UserRole } from "./user.service";

export type SafeUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  status: number;
  notificationPreferences: number | null;
  dateOfBirth: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AccessTokenPayload = {
  sub: number;
  email: string;
  role: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toSafeUser = (user: any): SafeUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  status: user.status,
  notificationPreferences: user.notificationPreferences,
  dateOfBirth: user.dateOfBirth,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const requireString = (input: any, field: string) => {
  const value = input?.[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

// Single source of truth for password strength rules. Used by both registration
// and change-password so the two flows can never drift apart.
const validatePassword = (password: string) => {
  if (password.length < authConfig.passwordMinLength) {
    throw new HttpError(
      400,
      `Field "password" must be at least ${authConfig.passwordMinLength} characters`,
    );
  }
};

const signAccessToken = (user: { id: number; email: string; role: string }) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role } satisfies AccessTokenPayload,
    authConfig.jwtAccessSecret,
    { expiresIn: authConfig.accessTokenExpiresIn } as SignOptions,
  );

const signRefreshToken = (userId: number) =>
  jwt.sign(
    { sub: userId, jti: crypto.randomBytes(16).toString("hex") },
    authConfig.jwtRefreshSecret,
    { expiresIn: authConfig.refreshTokenExpiresIn } as SignOptions,
  );

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const issueTokens = async (user: { id: number; email: string; role: string }) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  const refreshTokenHash = hashToken(refreshToken);
  const refreshTokenExpiresAt = new Date(
    Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash, refreshTokenExpiresAt },
  });
  return { accessToken, refreshToken };
};

export const authService = {
  register: async (input: {
    fullName?: unknown;
    email?: unknown;
    password?: unknown;
    phoneNumber?: unknown;
  }) => {
    requireString(input, "fullName");
    requireString(input, "email");
    requireString(input, "password");

    const email = String(input.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new HttpError(400, `Field must be a valid email: "email"`);
    }

    const password = String(input.password);
    validatePassword(password);

    // Public self-registration always creates a client account. Elevated roles
    // (admin/super) can only be assigned by a super via POST /users — never
    // through a role supplied in the registration body.
    const role: UserRole = "client";

    let phoneNumber: string | null = null;
    if (input.phoneNumber !== undefined && input.phoneNumber !== null && input.phoneNumber !== "") {
      if (typeof input.phoneNumber !== "string") {
        throw new HttpError(400, `Field must be a string: "phoneNumber"`);
      }
      const trimmed = input.phoneNumber.trim();
      if (trimmed.length > 20) {
        throw new HttpError(400, `Field "phoneNumber" must be at most 20 characters`);
      }
      phoneNumber = trimmed || null;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(400, `User with email "${email}" already exists`);

    const passwordHash = await bcrypt.hash(password, authConfig.bcryptSaltRounds);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        fullName: String(input.fullName).trim(),
        email,
        phoneNumber,
        role,
        status: 1,
        passwordHash,
        isVerified: false,
        verificationToken,
      },
    });

    return { user: toSafeUser(user), verificationToken };
  },

  login: async (input: { email?: unknown; password?: unknown }) => {
    requireString(input, "email");
    requireString(input, "password");

    const email = String(input.email).trim().toLowerCase();
    const password = String(input.password);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new HttpError(401, "Invalid credentials");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new HttpError(401, "Invalid credentials");

    if (user.status !== 1) {
      throw new HttpError(403, "Account is inactive");
    }

    if (!user.isVerified) {
      throw new HttpError(403, "Account is not verified");
    }

    const tokens = await issueTokens(user);
    return { ...tokens, user: toSafeUser(user) };
  },

  refresh: async (input: { refreshToken?: unknown }) => {
    requireString(input, "refreshToken");
    const refreshToken = String(input.refreshToken);

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, authConfig.jwtRefreshSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new HttpError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      throw new HttpError(401, "Invalid refresh token");
    }

    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new HttpError(401, "Refresh token expired");
    }

    if (hashToken(refreshToken) !== user.refreshTokenHash) {
      throw new HttpError(401, "Invalid refresh token");
    }

    const tokens = await issueTokens(user);
    return { ...tokens, user: toSafeUser(user) };
  },

  logout: async (userId: number) => {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  },

  verifyAccount: async (input: { token?: unknown }) => {
    requireString(input, "token");
    const token = String(input.token).trim();

    const user = await prisma.user.findUnique({ where: { verificationToken: token } });
    if (!user) throw new HttpError(400, "Invalid verification token");

    if (user.isVerified) {
      return toSafeUser(user);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null },
    });
    return toSafeUser(updated);
  },

  getCurrentUser: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, "User not found");
    return toSafeUser(user);
  },

  // The target user is always the authenticated caller (userId comes from the
  // verified JWT, never from the request body/params) so a user can only ever
  // change their own password.
  changePassword: async (
    userId: number,
    input: { currentPassword?: unknown; newPassword?: unknown },
  ) => {
    requireString(input, "currentPassword");
    requireString(input, "newPassword");

    const currentPassword = String(input.currentPassword);
    const newPassword = String(input.newPassword);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new HttpError(404, "User not found");
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new HttpError(400, "Current password is incorrect.");
    }

    // Hold the new password to the same strength rules as registration.
    validatePassword(newPassword);

    if (currentPassword === newPassword) {
      throw new HttpError(
        400,
        "The new password must be different from the current password.",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, authConfig.bcryptSaltRounds);

    // Persist the new hash and invalidate every existing refresh token, forcing
    // all other sessions to log in again.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  },

  verifyAccessToken: (token: string): AccessTokenPayload => {
    try {
      const payload = jwt.verify(token, authConfig.jwtAccessSecret) as jwt.JwtPayload;
      const sub = Number(payload.sub);
      if (!Number.isInteger(sub) || sub <= 0 || typeof payload.email !== "string") {
        throw new Error("malformed");
      }
      return {
        sub,
        email: payload.email,
        role: typeof payload.role === "string" ? payload.role : "",
      };
    } catch {
      throw new HttpError(401, "Invalid or expired access token");
    }
  },
};
