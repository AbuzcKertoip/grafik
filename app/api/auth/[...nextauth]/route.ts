import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    providers: [
        CredentialsProvider({
            name: "Sign in",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username },
                })

                if (!user) {
                    return null
                }

                const isValid = await verifyPassword(credentials.password, user.password)

                if (!isValid) {
                    return null
                }

                return {
                    id: user.id.toString(),
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    departmentId: user.departmentId,
                }
            },
        }),
    ],
    callbacks: {
        session: ({ session, token }) => {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id,
                    role: token.role,
                    departmentId: token.departmentId as number | undefined,
                },
            }
        },
        jwt: ({ token, user }) => {
            if (user) {
                const u = user as any
                return {
                    ...token,
                    id: u.id,
                    role: u.role,
                    departmentId: u.departmentId,
                }
            }
            return token
        },
    },
    pages: {
        signIn: "/login",
    },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
