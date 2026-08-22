import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE } from '@/server/session-cookie'

const PROTECTED_PREFIXES = ['/dashboard', '/trips', '/explore', '/community', '/profile', '/admin']
const AUTH_PAGES = ['/login', '/register']

function secretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

/** Structural check only — cannot reach Postgres from the edge. getSession() does the rest. */
async function hasStructurallyValidToken(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, secretKey())
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const signedIn = await hasStructurallyValidToken(request)

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page)

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && signedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/trips/:path*', '/explore/:path*', '/community/:path*', '/profile/:path*', '/admin/:path*', '/login', '/register'],
}
