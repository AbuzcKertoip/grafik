import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        role?: string
        username?: string
        departmentId?: number | null
    }

    interface Session {
        user: {
            id: string
            role?: string
            username?: string
            departmentId?: number
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role?: string
        departmentId?: number
    }
}
