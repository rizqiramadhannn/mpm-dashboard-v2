import { redirect } from "next/navigation";
import { listUsers, requireSuperadmin, setUserPassword } from "../../auth";
import { AppShell } from "../../components/AppShell";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireSuperadmin();
  const [params, users] = await Promise.all([searchParams, listUsers()]);

  return (
    <AppShell>
      <section className="customer-page">
        <div className="section-heading compact">
          <div>
            <p className="page-kicker">Admin</p>
            <h1>User Password</h1>
            <p>Superadmin dapat mengganti password user lain.</p>
          </div>
        </div>

        {params.saved ? (
          <p className="auth-success">Password user berhasil diubah.</p>
        ) : null}
        {params.error ? <p className="auth-error inline">{params.error}</p> : null}

        <div className="customer-table-wrap">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Password Baru</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="table-primary">{user.username}</td>
                  <td>{user.role}</td>
                  <td>
                    {user.mustChangePassword
                      ? "Wajib ganti password"
                      : "Password aktif"}
                  </td>
                  <td>
                    <form action={adminChangePasswordAction} className="admin-password-form">
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        minLength={6}
                        name="newPassword"
                        placeholder="Password baru"
                        required
                        type="password"
                      />
                      <button type="submit">Simpan</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

async function adminChangePasswordAction(formData: FormData) {
  "use server";

  const currentUser = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (userId === currentUser.id) {
    redirect(
      "/admin/users?error=Gunakan%20halaman%20Ubah%20Password%20untuk%20akun%20sendiri."
    );
  }

  const result = await setUserPassword(userId, newPassword);
  if (!result.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/admin/users?saved=1");
}
