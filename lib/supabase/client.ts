import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    "https://eobweyciqwoojwnsonor.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYndleWNpcXdvb2p3bnNvbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDAzNDMsImV4cCI6MjEwMzQ3NjM0M30.asNbhEvqmrGLNW7FA4Rys6XAHJSveN3B-13USG-INYI"
  )
}
