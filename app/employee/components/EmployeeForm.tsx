import { ConfirmForm } from "../../components/ConfirmForm";

type EmployeeFormValues = {
  accountNumber?: string;
  id?: string;
  jobdesk?: string;
  name?: string;
  salary?: number;
  status?: string;
  title?: string;
};

type EmployeeFormProps = {
  action: (formData: FormData) => Promise<void>;
  employee?: EmployeeFormValues;
  submitLabel: string;
  title: string;
};

export function EmployeeForm({
  action,
  employee,
  submitLabel,
  title,
}: EmployeeFormProps) {
  return (
    <section className="customer-page">
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Employee</p>
          <h1>{title}</h1>
        </div>
      </div>

      <ConfirmForm
        action={action}
        className="payment-request-form employee-form"
        confirmMessage={
          employee?.id
            ? "Simpan perubahan employee ini?"
            : "Tambah employee baru dengan data ini?"
        }
      >
        {employee?.id ? <input name="id" type="hidden" value={employee.id} /> : null}
        <label>
          <span>Nama</span>
          <input name="name" required placeholder="Nama employee" defaultValue={employee?.name ?? ""} />
        </label>
        <label>
          <span>Title</span>
          <input name="title" required placeholder="Admin Finance" defaultValue={employee?.title ?? ""} />
        </label>
        <label className="employee-jobdesk-field">
          <span>Jobdesk</span>
          <input
            name="jobdesk"
            required
            placeholder="Tanggung jawab utama"
            defaultValue={employee?.jobdesk ?? ""}
          />
        </label>
        <label>
          <span>Gaji</span>
          <input
            inputMode="numeric"
            name="salary"
            required
            placeholder="5000000"
            defaultValue={employee?.salary ?? ""}
          />
        </label>
        <label>
          <span>Nomor Rekening</span>
          <input
            name="accountNumber"
            required
            placeholder="BCA 123456789 a/n Nama"
            defaultValue={employee?.accountNumber ?? ""}
          />
        </label>
        <label>
          <span>Status</span>
          <input name="status" defaultValue={employee?.status ?? "Aktif"} />
        </label>
        <button type="submit">{submitLabel}</button>
      </ConfirmForm>
    </section>
  );
}
