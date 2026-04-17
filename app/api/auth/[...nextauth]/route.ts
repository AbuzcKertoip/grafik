import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { createLog } from "@/lib/actions/log-actions"

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

                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { username: credentials.username },
                            { email: credentials.username }
                        ]
                    },
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                })

                if (!user) {
                    await createLog({
                        action: "LOGIN_FAILED",
                        description: `Błędna próba logowania dla autoryzatora: ${credentials.username}`,
                        errorCodeKey: "AUTH_LOGIN_FAILED"
                    });
                    return null
                }

                const isValid = await verifyPassword(credentials.password, user.password)

                if (!isValid) {
                    await createLog({
                        action: "LOGIN_FAILED",
                        description: `Błędne hasło dla użytkownika: ${user.username}`,
                        errorCodeKey: "AUTH_LOGIN_FAILED"
                    });
                    return null
                }

                await createLog({
                    action: "LOGIN_SUCCESS",
                    description: `Pomyślne logowanie użytkownika: ${user.username}`,
                    userId: user.id,
                    errorCodeKey: "AUTH_LOGIN_SUCCESS"
                });

                let dynamicPermissions = user.permissions.map(p => p.permission.slug)

                if (user.role === 'MANAGER' && user.departmentId) {
                    const dept = await prisma.department.findUnique({ where: { id: user.departmentId } })
                    if (dept && dept.name.toUpperCase() === 'HR') {
                        if (!dynamicPermissions.includes('manage_hr_data')) dynamicPermissions.push('manage_hr_data')
                    }
                }

                return {
                    id: user.id.toString(),
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    departmentId: user.departmentId || undefined,
                    secondaryDepartmentId: user.secondaryDepartmentId || undefined,
                    permissions: dynamicPermissions,
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
                    secondaryDepartmentId: token.secondaryDepartmentId as number | undefined,
                    permissions: token.permissions as string[] | undefined,
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
                    secondaryDepartmentId: u.secondaryDepartmentId,
                    permissions: u.permissions,
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
