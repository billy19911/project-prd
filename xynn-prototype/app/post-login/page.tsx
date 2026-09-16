import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Tujuan setelah login: arahkan admin ke area admin, user biasa ke dashboard.
 * `?to=` dapat dipakai untuk callback URL spesifik (mis. dari produk).
 */
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const role = (session.user as { role?: string })?.role;
  const intended = params?.to;

  if (role === "ADMIN") {
    redirect("/admin");
  }

  if (intended && intended.startsWith("/")) {
    redirect(intended);
  }

  redirect("/dashboard");
}
