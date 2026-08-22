# GlobeTrotter Security Architecture & Control Verification

This document provides a comprehensive security review of the **GlobeTrotter** application, outlining implemented security controls, mitigation strategies, and architecture guidelines in alignment with OWASP Top 10 & OWASP API Security standards.

---

## 1. Implemented Security Controls & Verification Matrix

| # | Security Domain | Implemented Control | Location in Codebase | Mitigated Risk / Vulnerability | Status |
|---|---|---|---|---|---|
| **1** | **Authentication** | Password hashing via `bcryptjs` with cost factor 10. Generic error messages ("Incorrect email or password") to prevent email enumeration. | [`src/server/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/auth.ts#L33), [`src/server/actions/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/auth.ts#L18) | Credential theft, Account Enumeration | ✅ Fully Implemented |
| **2** | **Session Security** | JWT signed with HMAC-SHA256 (`jose`) stored in `HttpOnly`, `Secure` (production), `SameSite=Lax` cookies with 7-day expiration. | [`src/server/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/auth.ts#L41-L69) | XSS Token Theft, Session Fixation | ✅ Fully Implemented |
| **3** | **Rate Limiting** | Sliding-window rate limit store applied to sensitive endpoints (Login: max 5 req/min; Register: max 3 req/5 min). | [`src/lib/rate-limit.ts`](file:///d:/odoo/Globe-Trotter/src/lib/rate-limit.ts#L1-L54), [`src/server/actions/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/auth.ts#L33-L75) | Brute-force, Credential Stuffing, DoS | ✅ Fully Implemented |
| **4** | **Input Validation** | Strict Zod validation schemas for all inputs & search parameters. Rejection of invalid types, dates, lengths, and formats. | [`src/lib/validators.ts`](file:///d:/odoo/Globe-Trotter/src/lib/validators.ts#L1-L238) | Parameter Pollution, Type Confusion, Malformed Payloads | ✅ Fully Implemented |
| **5** | **Authorization (BOLA/IDOR)** | Server-side ownership checks (`assertTripOwner`, `assertStopOwner`, `assertTripActivityOwner`) on every single resource action. | [`src/server/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/auth.ts#L120-L137), [`src/server/actions/trips.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/trips.ts#L135) | BOLA / IDOR, Horizontal Privilege Escalation | ✅ Fully Implemented |
| **6** | **Admin Security** | RBAC validation via `requireAdmin()`. Non-admins receive `404 Not Found` (never `403 Forbidden`) to hide route existence. Self-suspension & self-demotion blocked. | [`src/server/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/auth.ts#L114-L118), [`src/server/actions/admin.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/admin.ts#L10-L31) | Vertical Privilege Escalation, Admin Route Probing | ✅ Fully Implemented |
| **7** | **SQL Injection** | Parameterized queries handled natively through Prisma ORM prepared statements. No raw SQL strings or string concatenations used. | [`src/server/db.ts`](file:///d:/odoo/Globe-Trotter/src/server/db.ts#L1-L8) | SQL Injection (SQLi) | ✅ Fully Implemented |
| **8** | **Security Headers** | Comprehensive HTTP headers: CSP (`frame-ancestors 'none'`, restrict script/style/img/connect sources), HSTS (`max-age=63072000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. | [`next.config.ts`](file:///d:/odoo/Globe-Trotter/next.config.ts#L30-L75) | Clickjacking, MIME Sniffing, MITM, XSS | ✅ Fully Implemented |
| **9** | **CSRF Protection** | Next.js Server Actions with strict origin verification & `SameSite=Lax` cookies. | [`src/middleware.ts`](file:///d:/odoo/Globe-Trotter/src/middleware.ts#L1-L54) | Cross-Site Request Forgery (CSRF) | ✅ Fully Implemented |
| **10** | **Error Sanitization** | `guard()` higher-order function catches uncaught server action exceptions and returns generic client-facing messages while logging details internally. | [`src/lib/action-result.ts`](file:///d:/odoo/Globe-Trotter/src/lib/action-result.ts#L41-L54) | Internal Stack Trace Leakage, System Profiling | ✅ Fully Implemented |
| **11** | **File Upload & Payload Caps** | Max photo payload size checked server-side (`MAX_PHOTO_BASE64_LENGTH` ~2MB) and Next.js `bodySizeLimit` set to 4MB. | [`src/server/actions/auth.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/auth.ts#L19-L26), [`next.config.ts`](file:///d:/odoo/Globe-Trotter/next.config.ts#L30) | Unrestricted File Upload, DoS | ✅ Fully Implemented |
| **12** | **Mass Assignment** | DTO destructuring from Zod-validated data before database persistence. No direct object merging into Prisma models. | All Server Actions ([`src/server/actions/*.ts`](file:///d:/odoo/Globe-Trotter/src/server/actions/)) | Mass Assignment, Unexpected Property Overwrites | ✅ Fully Implemented |

---

## 2. Security Architecture Overview

### A. Authentication & Session Management
- **Token Signing**: JWTs signed using `SignJWT` from `jose` with HS256 algorithm.
- **Cookie Security**: Cookies are flagged as `HttpOnly`, `SameSite=Lax`, and `Secure` in production environments (`process.env.NODE_ENV === 'production'`).
- **Authorization Flow**:
  - Middleware enforces token structural integrity before permitting request routing.
  - Server actions perform full database lookups (`getSession()`) wrapped with React `cache` to verify account `isActive` status per render cycle.

### B. Defensive Rate Limiting
- **Location**: [`src/lib/rate-limit.ts`](file:///d:/odoo/Globe-Trotter/src/lib/rate-limit.ts)
- **Mechanism**: In-memory sliding-window bucket store mapped by client IP (`x-forwarded-for` / `x-real-ip`).
- **Cleanup**: Periodic 60-second garbage collection sweeps out expired entries to maintain minimal memory overhead.

### C. Resource Ownership & Access Control (RBAC)
- All CRUD operations on trips, stops, activities, expenses, and posts require strict ownership matching (`userId === session.id`).
- Admin endpoints enforce `isAdmin === true`. Non-admin access results in an immediate `notFound()` invocation to prevent endpoint discovery.

---

## 3. Infrastructure & External Security Recommendations

While all application-level controls are strictly implemented in the codebase, production deployment should be paired with the following infrastructure-level security components:

1. **Web Application Firewall (WAF) & CDN**:
   - Deploy behind Cloudflare, AWS CloudFront, or Vercel WAF for global DDoS mitigation, IP reputation scoring, and bot protection.
2. **Distributed Rate Limiting (Redis)**:
   - For multi-instance horizontal scaling, swap the in-memory rate limiter in `src/lib/rate-limit.ts` with a centralized Redis instance (e.g., Upstash or Redis Enterprise).
3. **Database Network Isolation**:
   - Ensure PostgreSQL database instances reside within a private VPC and only accept connections from the application server security group.
4. **Secret Management**:
   - Store `JWT_SECRET` and `DATABASE_URL` in a managed vault (AWS Secrets Manager, HashiCorp Vault, or environment vault).
