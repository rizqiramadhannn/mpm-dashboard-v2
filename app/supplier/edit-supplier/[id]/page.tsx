import { AppShell } from "../../../components/AppShell";
import { SupplierForm } from "../../components/SupplierForm";
import { getSupplier, updateSupplierAction } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(Number(id));

  return (
    <AppShell>
      <SupplierForm
        action={updateSupplierAction}
        supplier={supplier}
        title="Edit supplier"
      />
    </AppShell>
  );
}
