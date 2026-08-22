import { redirect } from 'next/navigation'
import { getSession, landingPathFor } from '@/server/auth'

// `/` is deliberately left out of the middleware matcher: signed-out visitors must be able
// to reach it, and only here — with DB access — can we tell an admin from a regular user.
export default async function RootPage() {
  const session = await getSession()
  redirect(session ? landingPathFor(session) : '/login')
}
