import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        role?: string
        username?: string
        departmentId?: number | null
        permissions?: string[]
    }

    interface Session {
        user: {
            id: string
            role?: string
            username?: string
            departmentId?: number
            permissions?: string[]
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role?: string
        departmentId?: number
        permissions?: string[]
    }
}
