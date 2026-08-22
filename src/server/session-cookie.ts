// Isolated from auth.ts on purpose: middleware.ts runs on the Edge Runtime and must never
// pull in Prisma or bcryptjs, so the cookie name lives in its own dependency-free module.
export const SESSION_COOKIE = 'gt_session'
