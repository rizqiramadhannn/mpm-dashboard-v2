import { AppShell } from "../../components/AppShell";
import { requireSuperadmin } from "../../auth";
import { EmployeeForm } from "../components/EmployeeForm";
import { createEmployeeAction } from "../data";

export const dynamic = "force-dynamic";

export default async function AddNewEmployeePage() {
  await requireSuperadmin("/employee/add-new-employee");

  return (
    <AppShell>
      <EmployeeForm
        action={createEmployeeAction}
        submitLabel="Tambah Employee"
        title="Add new employee"
      />
    </AppShell>
  );
}
