import { AppShell } from "../../../components/AppShell";
import { requireSuperadmin } from "../../../auth";
import { EmployeeForm } from "../../components/EmployeeForm";
import { getEmployee, updateEmployeeAction } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSuperadmin(`/employee/edit-employee/${id}`);
  const employee = await getEmployee(id);

  return (
    <AppShell>
      <EmployeeForm
        action={updateEmployeeAction}
        employee={employee}
        submitLabel="Simpan Employee"
        title="Edit employee"
      />
    </AppShell>
  );
}
