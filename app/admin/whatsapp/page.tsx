import { requireSuperadmin } from "../../auth";
import { AppShell } from "../../components/AppShell";
import WhatsAppDashboard from "./WhatsAppDashboard";

export const dynamic = "force-dynamic";
export default async function WhatsAppPage() {
  await requireSuperadmin("/admin/whatsapp");
  return <AppShell><WhatsAppDashboard /></AppShell>;
}
