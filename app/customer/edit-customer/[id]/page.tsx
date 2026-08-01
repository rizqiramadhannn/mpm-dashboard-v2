import { AppShell } from "../../../components/AppShell";
import { CustomerForm } from "../../components/CustomerForm";
import { getCustomer, updateCustomerAction } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  return (
    <AppShell>
      <CustomerForm
        action={updateCustomerAction}
        customer={customer}
        customers={[]}
        showList={false}
        title="Edit customer"
      />
    </AppShell>
  );
}
