import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-guard'

export async function updateSession(request: NextRequest) {
  // Skip if Supabase credentials are not available (build time)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Admin route protection (middleware layer — fast early rejection)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectRes = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value, c))
      return redirectRes
    }
    if (!isAdmin(user)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.searchParams.set('error', 'access_denied')
      const redirectRes = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value, c))
      return redirectRes
    }
    // Admin user navigating inside /admin: clear view_as_user cookie so future direct visits default to admin dashboard
    if (request.cookies.has('view_as_user')) {
      supabaseResponse.cookies.delete('view_as_user')
    }
    return supabaseResponse
  }

  // Intercept /dashboard requests: If the user is an admin, send them to /admin/dashboard
  // UNLESS they explicitly opted into viewing as a user (?view=user or view_as_user cookie)
  if (request.nextUrl.pathname === '/dashboard') {
    const isUserView =
      request.nextUrl.searchParams.get('view') === 'user' ||
      request.cookies.get('view_as_user')?.value === 'true'

    if (user && isAdmin(user)) {
      if (!isUserView) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        const redirectRes = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value, c))
        return redirectRes
      } else {
        supabaseResponse.cookies.set('view_as_user', 'true', { path: '/' })
        return supabaseResponse
      }
    }
  }

  if (
    // if the user is not logged in and the app path, in this case, /protected, is accessed, redirect to the login page
    request.nextUrl.pathname.startsWith('/protected') &&
    !user
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
