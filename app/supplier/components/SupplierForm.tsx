type SupplierRow = {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  accountType: string;
  accountNumber: string;
  accountName: string;
  defaultPaymentTerm: string;
};

type SupplierFormProps = {
  action: (formData: FormData) => Promise<void>;
  supplier?: SupplierRow;
  title?: string;
};

type SupplierListProps = {
  deleteAction: (formData: FormData) => Promise<void>;
  suppliers: SupplierRow[];
  title?: string;
};

export function SupplierForm({
  action,
  supplier,
  title = "Add new supplier",
}: SupplierFormProps) {
  return (
    <section className="customer-page">
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Supplier</p>
          <h1>{title}</h1>
        </div>
      </div>

      <form action={action} className="customer-form">
        {supplier ? <input name="id" type="hidden" value={supplier.id} /> : null}

        <label>
          <span>Nama Supplier</span>
          <input
            name="name"
            required
            defaultValue={supplier?.name ?? ""}
            placeholder="PT ABADI JAYA MACHINERY"
          />
        </label>

        <label>
          <span>PIC Supplier</span>
          <input
            name="contactPerson"
            required
            defaultValue={supplier?.contactPerson ?? ""}
            placeholder="Nama PIC"
          />
        </label>

        <label>
          <span>Kontak PIC</span>
          <input
            name="phone"
            required
            defaultValue={supplier?.phone ?? ""}
            placeholder="08xxxxxxxxxx"
          />
        </label>

        <label>
          <span>Tipe Rekening</span>
          <input
            name="accountType"
            required
            defaultValue={supplier?.accountType ?? ""}
            placeholder="BCA / Mandiri / Dana"
          />
        </label>

        <label>
          <span>Nomor Rekening</span>
          <input
            name="accountNumber"
            required
            defaultValue={supplier?.accountNumber ?? ""}
            placeholder="1234567890"
          />
        </label>

        <label>
          <span>Nama Rekening</span>
          <input
            name="accountName"
            required
            defaultValue={supplier?.accountName ?? ""}
            placeholder="PT ABADI JAYA MACHINERY"
          />
        </label>

        <label>
          <span>TOP Supplier</span>
          <input
            name="defaultPaymentTerm"
            required
            defaultValue={supplier?.defaultPaymentTerm ?? ""}
            placeholder="TOP 30 hari"
          />
        </label>

        <button type="submit">{supplier ? "Simpan supplier" : "Buat supplier"}</button>
      </form>
    </section>
  );
}

export function SupplierList({
  deleteAction,
  suppliers,
  title = "List supplier",
}: SupplierListProps) {
  return (
    <section className="customer-page">
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Supplier</p>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="customer-table-wrap">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Nama Supplier</th>
              <th>PIC Supplier</th>
              <th>Kontak PIC</th>
              <th>Tipe Rekening</th>
              <th>Nomor Rekening</th>
              <th>Nama Rekening</th>
              <th>TOP Supplier</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length > 0 ? (
              suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.name}</td>
                  <td>{supplier.contactPerson}</td>
                  <td>{supplier.phone}</td>
                  <td>{supplier.accountType}</td>
                  <td>{supplier.accountNumber}</td>
                  <td>{supplier.accountName}</td>
                  <td>{supplier.defaultPaymentTerm}</td>
                  <td>
                    <div className="table-actions">
                      <a href={`/supplier/edit-supplier/${supplier.id}`}>Edit</a>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={supplier.id} />
                        <button type="submit" className="danger">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>Belum ada supplier.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
