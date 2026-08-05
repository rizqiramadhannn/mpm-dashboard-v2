import { redirect } from "next/navigation";
import { requireUser, updateOwnPassword } from "../auth";

export const dynamic = "force-dynamic";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const user = await requireUser("/change-password");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <p className="page-kicker">Akun {user.username}</p>
          <h1 className="auth-title">Ubah Password</h1>
          {user.mustChangePassword ? (
            <p className="auth-copy">Login pertama wajib mengganti password.</p>
          ) : null}
        </div>

        <form action={changePasswordAction} className="auth-form">
          <label>
            <span>Password Lama</span>
            <input
              autoComplete="current-password"
              name="currentPassword"
              required
              type="password"
            />
          </label>
          <label>
            <span>Password Baru</span>
            <input
              autoComplete="new-password"
              minLength={6}
              name="newPassword"
              required
              type="password"
            />
          </label>
          <label>
            <span>Ulangi Password Baru</span>
            <input
              autoComplete="new-password"
              minLength={6}
              name="confirmPassword"
              required
              type="password"
            />
          </label>
          {params.error ? <p className="auth-error">{params.error}</p> : null}
          <button type="submit">Simpan Password</button>
        </form>
      </section>
    </main>
  );
}

async function changePasswordAction(formData: FormData) {
  "use server";

  const user = await requireUser("/change-password");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=Password%20baru%20tidak%20sama.");
  }

  const result = await updateOwnPassword(user, currentPassword, newPassword);
  if (!result.ok) {
    redirect(`/change-password?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/dashboard");
}
