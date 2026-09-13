import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    "https://eobweyciqwoojwnsonor.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImvYndleWNpcXdvb2p3bnNvbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDAzNDMsImV4cCI6MjEwMzQ3NjM0M30.asNbhEvqmrGLNW7FA4Rys6XAHJSveN3B-13USG-INYI",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}
