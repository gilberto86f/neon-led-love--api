import { AccessTokenPayload } from "../services/auth.service";

// Reusable ownership/role predicates. These operate purely on the verified JWT
// payload (`req.auth`) and the resource owner id taken from the path/DB — never
// on ids coming from the request body.

export const isStaff = (role: string): boolean => role === "super" || role === "admin";

const isSelf = (auth: AccessTokenPayload, userId: number): boolean => auth.sub === userId;

/**
 * GET /users/:id — super and admin may read any user; a client may read only
 * their own account.
 */
export const canViewUser = (auth: AccessTokenPayload, requestedUserId: number): boolean =>
  isStaff(auth.role) || isSelf(auth, requestedUserId);

/**
 * PUT/DELETE /users/:id — only super may manage other users; everyone else
 * (admin and client) may manage only their own account.
 */
export const canManageUser = (auth: AccessTokenPayload, requestedUserId: number): boolean =>
  auth.role === "super" || isSelf(auth, requestedUserId);

/**
 * Orders — staff (super/admin) may access any order; a client may access only
 * orders they own.
 */
export const canAccessOrder = (auth: AccessTokenPayload, ownerUserId: number): boolean =>
  isStaff(auth.role) || isSelf(auth, ownerUserId);

/**
 * Quotes — staff (super/admin) may access any quote; a client may access only
 * quotes they own. Guest-submitted quotes have no owner (`clientId === null`)
 * and are therefore reachable by staff only.
 */
export const canAccessQuote = (
  auth: AccessTokenPayload,
  ownerClientId: number | null,
): boolean => isStaff(auth.role) || (ownerClientId !== null && isSelf(auth, ownerClientId));
