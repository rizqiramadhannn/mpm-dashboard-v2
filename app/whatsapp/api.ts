import { getCurrentUser } from "../auth";

export async function whatsappApiGuard(request: Request, mutation = false): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Login diperlukan." }, { status: 401 });
  if (user.role !== "superadmin" || user.mustChangePassword) {
    return Response.json({ error: "Hanya superadmin yang dapat mengakses Sync WhatsApp." }, { status: 403 });
  }
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Origin tidak valid." }, { status: 403 });
  }
  return null;
}
export function apiFailure(error: unknown) {
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
    ? error.status : 500;
  const message = error instanceof Error ? error.message : "Gagal memproses permintaan WhatsApp.";
  return Response.json({ error: message }, { status });
}
