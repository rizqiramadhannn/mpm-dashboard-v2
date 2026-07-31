import { AppShell } from "../../components/AppShell";
import { CustomerForm } from "../components/CustomerForm";
import { listCustomers } from "../data";

export const dynamic = "force-dynamic";

export default async function CustomerListPage() {
  const customerRows = await listCustomers();

  return (
    <AppShell>
      <CustomerForm customers={customerRows} showForm={false} />
    </AppShell>
  );
}
