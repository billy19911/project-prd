import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

const hasGoogle = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email: string): boolean {
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Terima semua undangan tim yang tertunda untuk email ini.
 *
 * Dipanggil saat login. Idempoten: undangan yang sudah ACCEPTED tidak
 * disentuh lagi, dan keanggotaan yang sudah ada tidak diduplikasi.
 * Kegagalan di sini TIDAK boleh menggagalkan login.
 *
 * Seat dijaga DI SINI juga, bukan hanya saat mengundang: undangan bisa
 * dibuat sebelum seat penuh lalu menumpuk. Klaim undangan dilakukan atomik
 * (`updateMany` dengan guard `status: PENDING`) supaya dua login bersamaan
 * tidak menambah anggota dua kali.
 */
async function acceptPendingInvites(email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return;

    const invites = await prisma.organizationInvite.findMany({
      where: { email, status: "PENDING" },
      select: { id: true, organizationId: true, role: true },
    });
    if (invites.length === 0) return;

    for (const inv of invites) {
      // Sudah anggota? cukup tandai undangan selesai, jangan buat baris baru.
      const existing = await prisma.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: inv.organizationId,
            userId: user.id,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        // Hormati batas seat saat menerima undangan.
        const [org, used] = await Promise.all([
          prisma.organization.findUnique({
            where: { id: inv.organizationId },
            select: { seatLimit: true },
          }),
          prisma.membership.count({ where: { organizationId: inv.organizationId } }),
        ]);
        if (!org || used >= org.seatLimit) {
          // Seat penuh: jangan menerima, biarkan undangan tetap tertunda
          // agar bisa diproses setelah seat dibebaskan.
          continue;
        }
      }

      // Klaim undangan secara atomik: hanya lanjut bila masih PENDING.
      const claimed = await prisma.organizationInvite.updateMany({
        where: { id: inv.id, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      if (claimed.count === 0) continue; // sudah diproses login lain.

      if (!existing) {
        // upsert agar aman bila balapan dengan pembuatan anggota di tempat lain.
        await prisma.membership.upsert({
          where: {
            organizationId_userId: {
              organizationId: inv.organizationId,
              userId: user.id,
            },
          },
          update: {},
          create: {
            organizationId: inv.organizationId,
            userId: user.id,
            role: inv.role,
          },
        });
      }
    }
  } catch (error) {
    // Jangan blokir login karena masalah undangan.
    console.error("[auth] Gagal memproses undangan tim:", error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(!hasGoogle || process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            name: "Demo Email",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;

              try {
                let user = await prisma.user.findUnique({
                  where: { email: credentials.email },
                });

                if (!user) {
                  user = await prisma.user.create({
                    data: {
                      email: credentials.email,
                      name: credentials.email.split("@")[0],
                      role: isAdminEmail(credentials.email) ? "ADMIN" : "USER",
                      subscription: {
                        create: {
                          planType: "FREE",
                          status: "INACTIVE",
                          prdLimit: 1,
                        },
                      },
                    },
                  });
                } else if (isAdminEmail(credentials.email) && user.role !== "ADMIN") {
                  user = await prisma.user.update({
                    where: { id: user.id },
                    data: { role: "ADMIN" },
                  });
                }

                return {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  image: user.avatarUrl,
                };
              } catch (error) {
                console.error("[auth] Demo login gagal:", error);
                return null;
              }
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "google") {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (!existing) {
            await prisma.user.create({
              data: {
                email: user.email,
                name: user.name,
                avatarUrl: user.image,
                role: isAdminEmail(user.email) ? "ADMIN" : "USER",
                subscription: {
                  create: {
                    planType: "FREE",
                    status: "INACTIVE",
                    prdLimit: 1,
                  },
                },
              },
            });
          } else if (isAdminEmail(user.email) && existing.role !== "ADMIN") {
            await prisma.user.update({
              where: { id: existing.id },
              data: { role: "ADMIN" },
            });
          }
        } catch (error) {
          // Jangan biarkan error DB (mis. koneksi putus) mem-bocorkan pesan
          // non-ASCII ke header redirect NextAuth — cukup tolak login.
          console.error("[auth] Auto-provisioning gagal:", error);
          return false;
        }
      }
      // Aktifkan undangan tim yang tertunda untuk email ini. Dijalankan untuk
      // SEMUA provider (Google & kredensial) agar undangan ke orang yang belum
      // punya akun tetap terpasang saat mereka pertama kali login.
      await acceptPendingInvites(user.email);
      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email || token.email;
      if (!email) return token;

      try {
        const dbUser = await withDbRetry(() =>
          prisma.user.findUnique({
            where: { email },
            include: { subscription: true },
          })
        );
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.plan = dbUser.subscription?.planType ?? "FREE";
        }
      } catch (error) {
        console.error("[auth] Gagal memuat user untuk JWT:", error);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: token.id ?? "",
          role: token.role ?? "USER",
          plan: token.plan ?? "FREE",
        });
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};