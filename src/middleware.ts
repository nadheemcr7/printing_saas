import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Only run auth logic on protected routes
    const isProtected = pathname.startsWith('/dashboard')
    const isAuthPage = pathname === '/login' || pathname === '/signup'

    // Skip middleware entirely for non-protected, non-auth pages (like landing page)
    if (!isProtected && !isAuthPage) {
        return NextResponse.next()
    }

    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({ name, value, ...options })
                        response = NextResponse.next({
                            request: { headers: request.headers },
                        })
                        response.cookies.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({ name, value: '', ...options })
                        response = NextResponse.next({
                            request: { headers: request.headers },
                        })
                        response.cookies.set({ name, value: '', ...options })
                    },
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()

        // Protected dashboard routes
        if (isProtected) {
            if (!user) {
                return NextResponse.redirect(new URL('/login', request.url))
            }

            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const role = profileData?.role

            if (pathname.startsWith('/dashboard/owner') && role !== 'owner') {
                return NextResponse.redirect(new URL('/dashboard/customer', request.url))
            }
            if (pathname.startsWith('/dashboard/developer') && role !== 'developer') {
                return NextResponse.redirect(new URL('/dashboard/owner', request.url))
            }
        }

        // Redirect logged-in users away from login/signup
        if (isAuthPage && user) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const role = profileData?.role
            const target = role === 'developer'
                ? '/dashboard/developer'
                : role === 'owner'
                    ? '/dashboard/owner'
                    : '/dashboard/customer'
            return NextResponse.redirect(new URL(target, request.url))
        }
    } catch (e) {
        console.error('Middleware error:', e)
        // Don't block the site if auth check fails
    }

    return response
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/login',
        '/signup',
    ],
}
