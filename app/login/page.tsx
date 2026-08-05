import { redirect } from "next/navigation";
import { authenticateUser, getCurrentUser } from "../auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    return_to?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect(currentUser.mustChangePassword ? "/change-password" : "/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/sph-assets/mpm-logo-source.png" />
          <div>
            <p>MOROWALI PUTRA MANDIRI</p>
            <span>Dashboard Login</span>
          </div>
        </div>

        <form action={loginAction} className="auth-form">
          <input
            name="returnTo"
            type="hidden"
            value={safeReturnPath(params.return_to ?? "/dashboard")}
          />
          <label>
            <span>Username</span>
            <input autoComplete="username" name="username" required />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>
          {params.error || params.message ? (
            <p className="auth-error">
              {params.message ?? "Username atau password tidak sesuai."}
            </p>
          ) : null}
          <button type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}

async function loginAction(formData: FormData) {
  "use server";

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/dashboard"));
  const result = await authenticateUser(username, password);

  if (!result.ok || !result.user) {
    const message = result.message || "Username atau password tidak sesuai.";
    redirect(
      `/login?error=1&message=${encodeURIComponent(message)}&return_to=${encodeURIComponent(returnTo)}`
    );
  }

  redirect(result.user.mustChangePassword ? "/change-password" : returnTo);
}

function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value === "/login" || value.startsWith("/login?")) {
    return "/dashboard";
  }

  return value;
}
