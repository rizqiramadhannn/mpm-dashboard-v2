import { redirect } from "next/navigation";
import {
  listAdminAuditLogs,
  listUsers,
  requireSuperadmin,
  setUserPassword,
} from "../../auth";
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
  const [params, users, auditLogs] = await Promise.all([
    searchParams,
    listUsers(),
    listAdminAuditLogs(),
  ]);

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

        <section className="admin-audit-section">
          <div className="section-heading compact">
            <div>
              <p className="page-kicker">Audit Log</p>
              <h2>Aktivitas Admin</h2>
              <p>Riwayat 50 aksi admin terakhir.</p>
            </div>
          </div>

          <div className="customer-table-wrap">
            <table className="customer-table admin-audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Admin</th>
                  <th>Aksi</th>
                  <th>Target</th>
                  <th>IP</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr
                      key={`${log.createdAt}-${log.actorUsername}-${log.targetUsername}`}
                    >
                      <td>{formatAuditTime(log.createdAt)}</td>
                      <td className="table-primary">{log.actorUsername}</td>
                      <td>{formatAction(log.action)}</td>
                      <td>{log.targetUsername || "-"}</td>
                      <td>{log.ipAddress}</td>
                      <td>{formatDetails(log.detailsJson)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Belum ada aktivitas admin.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
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

  const result = await setUserPassword(currentUser, userId, newPassword);
  if (!result.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/admin/users?saved=1");
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    user_password_reset: "Reset password user",
  };

  return labels[action] ?? action;
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDetails(details: Record<string, unknown>) {
  if (details.mustChangePassword) {
    return "User wajib ganti password saat login berikutnya.";
  }

  return "-";
}
