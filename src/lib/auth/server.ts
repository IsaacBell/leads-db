import { Pool } from "pg"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins/magic-link"

const baseURL = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || undefined

/**
 * Better Auth server. See src/lib/auth/client.ts for the browser client.
 *
 * Magic-link sign-in only. No email/password, no OAuth (for now). Emails are
 * sent via Resend when RESEND_API_KEY is present; otherwise the magic link is
 * logged to the console so a bare local checkout can exercise the flow
 * without a mail provider.
 */
export const auth = betterAuth({
  appName: "LeadsDB",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.LDB_DATABASE_URL }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    nextCookies(),
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
          if (process.env.NODE_ENV === "production") {
            throw new Error("RESEND_API_KEY is not configured; magic links cannot be sent.")
          }
          console.log(`[better-auth] magic link for ${email}:\n${url}`)
          return
        }

        const from = process.env.RESEND_FROM || "LeadsDB <onboarding@resend.dev>"
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject: "Sign in to LeadsDB",
            text: `Sign in to LeadsDB by opening this link:\n\n${url}\n\nIf you did not request this, you can safely ignore this email.`,
          }),
        })

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          throw new Error(`Failed to send magic link email (${response.status}) ${body}`)
        }
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
