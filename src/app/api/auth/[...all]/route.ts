import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/src/lib/auth/server"

// pg needs the Node runtime, not the edge runtime.
// export const runtime = "nodejs"

export const { GET, POST } = toNextJsHandler(auth)
