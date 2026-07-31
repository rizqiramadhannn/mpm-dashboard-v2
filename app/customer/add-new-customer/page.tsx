import { AppShell } from "../../components/AppShell";
import { CustomerForm } from "../components/CustomerForm";
import { createCustomerAction, listCustomers } from "../data";

export const dynamic = "force-dynamic";

export default async function AddNewCustomerPage() {
  const customerRows = await listCustomers();

  return (
    <AppShell>
      <CustomerForm
        action={createCustomerAction}
        customers={customerRows}
        showList={false}
        title="Add new customer"
      />
    </AppShell>
  );
}
