import { AppShell } from "../../components/AppShell";
import { SupplierForm } from "../components/SupplierForm";
import { createSupplierAction } from "../data";

export const dynamic = "force-dynamic";

export default async function AddNewSupplierPage() {
  return (
    <AppShell>
      <SupplierForm action={createSupplierAction} title="Add new supplier" />
    </AppShell>
  );
}
