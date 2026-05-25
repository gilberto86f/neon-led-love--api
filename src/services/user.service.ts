import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export const USER_ROLES = ["admin", "client", "super"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUS = [0, 1] as const; // 0 = INACTIVE, 1 = ACTIVE
export type UserStatus = (typeof USER_STATUS)[number];

export const NOTIFICATION_PREFERENCES = [1, 2, 3] as const; // 1 = EMAIL, 2 = SMS, 3 = WHATS_APP
export type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];

export interface UserInput {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: UserRole;
  status?: UserStatus;
  notificationPreferences?: NotificationPreference | null;
  dateOfBirth?: string | null;
}

const requireString = (input: Partial<UserInput>, field: keyof UserInput) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validate = (input: Partial<UserInput>) => {
  requireString(input, "fullName");

  requireString(input, "email");
  if (!EMAIL_RE.test(String(input.email).trim())) {
    throw new HttpError(400, `Field must be a valid email: "email"`);
  }

  if (typeof input.role !== "string" || !USER_ROLES.includes(input.role as UserRole)) {
    throw new HttpError(400, `Field "role" must be one of: ${USER_ROLES.join(", ")}`);
  }

  if (input.phoneNumber !== undefined && input.phoneNumber !== null) {
    if (typeof input.phoneNumber !== "string") {
      throw new HttpError(400, `Field must be a string: "phoneNumber"`);
    }
    if (input.phoneNumber.trim().length > 20) {
      throw new HttpError(400, `Field "phoneNumber" must be at most 20 characters`);
    }
  }

  if (input.status !== undefined && input.status !== null) {
    if (!USER_STATUS.includes(input.status as UserStatus)) {
      throw new HttpError(400, `Field "status" must be one of: ${USER_STATUS.join(", ")}`);
    }
  }

  if (input.notificationPreferences !== undefined && input.notificationPreferences !== null) {
    if (!NOTIFICATION_PREFERENCES.includes(input.notificationPreferences as NotificationPreference)) {
      throw new HttpError(
        400,
        `Field "notificationPreferences" must be one of: ${NOTIFICATION_PREFERENCES.join(", ")}`,
      );
    }
  }

  if (input.dateOfBirth !== undefined && input.dateOfBirth !== null) {
    if (typeof input.dateOfBirth !== "string" || !DATE_RE.test(input.dateOfBirth.trim())) {
      throw new HttpError(400, `Field "dateOfBirth" must be a date in YYYY-MM-DD format`);
    }
  }
};

const normalize = (input: UserInput) => ({
  fullName: input.fullName.trim(),
  email: input.email.trim().toLowerCase(),
  phoneNumber: input.phoneNumber?.trim() || null,
  role: input.role.trim(),
  status: input.status ?? 1,
  notificationPreferences: input.notificationPreferences ?? null,
  dateOfBirth: input.dateOfBirth?.trim() || null,
});

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  role: true,
  status: true,
  notificationPreferences: true,
  dateOfBirth: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ensureUniqueEmail = async (email: string, excludeUserId?: number) => {
  const existing = await prisma.user.findFirst({
    where: {
      email,
      ...(excludeUserId !== undefined ? { NOT: { id: excludeUserId } } : {}),
    },
  });
  if (existing) throw new HttpError(400, `User with email "${email}" already exists`);
};

const getUserById = async (id: number) => {
  const user = await prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
  if (!user) throw new HttpError(404, `User not found ${id}`);
  return user;
};

export const userService = {
  getUsers: async ({
    page,
    perPage,
    search,
    role,
    status,
  }: {
    page: number;
    perPage: number;
    search?: string;
    role?: UserRole;
    status?: UserStatus;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role !== undefined) where.role = role;
    if (status !== undefined) where.status = status;
    const [results, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: perPage,
        select: PUBLIC_USER_SELECT,
      }),
      prisma.user.count({ where }),
    ]);
    return { results, total };
  },

  getUserById,

  createUser: async (input: UserInput) => {
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueEmail(normalized.email);
    return prisma.user.create({ data: normalized, select: PUBLIC_USER_SELECT });
  },

  updateUser: async (id: number, input: UserInput) => {
    await getUserById(id);
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueEmail(normalized.email, id);
    return prisma.user.update({ where: { id }, data: normalized, select: PUBLIC_USER_SELECT });
  },

  deleteUser: async (id: number) => {
    await getUserById(id);
    const orderCount = await prisma.order.count({ where: { userId: id } });
    if (orderCount > 0) {
      throw new HttpError(
        400,
        `Cannot delete user ${id}: user has ${orderCount} order${orderCount === 1 ? "" : "s"}. Delete them first.`,
      );
    }
    await prisma.user.delete({ where: { id } });
  },
};
