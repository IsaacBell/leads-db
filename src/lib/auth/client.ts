import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

/**
 * Better Auth browser client. Talks to the /api/auth/* route handler served
 * from this same app; auth state rides on an httpOnly session cookie, so the
 * browser never holds an API token.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
