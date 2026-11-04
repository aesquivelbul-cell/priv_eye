import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip middleware during static generation
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.next({ request })
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api routes
     * - public auth/landing pages (login, signup, welcome, auth/*, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|login|signup|welcome|auth|forgot-password|reset-password|privacy|terms|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
