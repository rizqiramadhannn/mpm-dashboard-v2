import { AppShell } from "../../components/AppShell";
import { SupplierList } from "../components/SupplierForm";
import { deleteSupplierAction, listSuppliers } from "../data";

export const dynamic = "force-dynamic";

export default async function SupplierListPage() {
  const supplierRows = await listSuppliers();

  return (
    <AppShell>
      <SupplierList deleteAction={deleteSupplierAction} suppliers={supplierRows} />
    </AppShell>
  );
}
