type CustomerRow = {
  id: number;
  code: string;
  name: string;
  detailLine1: string;
  detailLine2: string;
  detailLine3: string;
  contactName: string;
};

type CustomerFormProps = {
  action?: (formData: FormData) => Promise<void>;
  customers: CustomerRow[];
  showForm?: boolean;
  showList?: boolean;
  title?: string;
};

export function CustomerForm({
  action,
  customers,
  showForm = true,
  showList = true,
  title = "Customer list",
}: CustomerFormProps) {
  return (
    <section className="customer-page">
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Customer</p>
          <h1>{title}</h1>
        </div>
      </div>

      {showForm && action ? (
        <form action={action} className="customer-form">
          <label>
            <span>Kode Customer</span>
            <input name="code" required placeholder="AJB" maxLength={12} />
          </label>

          <label>
            <span>Nama Customer</span>
            <input name="name" required placeholder="PT Albar Jaya Bersama" />
          </label>

          <label>
            <span>Franco / Detail 1</span>
            <input name="detailLine1" required placeholder="Kendari" />
          </label>

          <label>
            <span>Provinsi / Detail 2</span>
            <input name="detailLine2" required placeholder="Sulawesi Tenggara" />
          </label>

          <label>
            <span>Detail 3</span>
            <input name="detailLine3" placeholder="Up Ibu Rahba" />
          </label>

          <label>
            <span>PIC</span>
            <input name="contactName" placeholder="Ibu Rahba" />
          </label>

          <button type="submit">Buat customer</button>
        </form>
      ) : null}

      {showList ? (
        <div className="customer-table-wrap">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Customer</th>
                <th>Detail 1</th>
                <th>Detail 2</th>
                <th>Detail 3</th>
                <th>PIC</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.code}</td>
                    <td>{customer.name}</td>
                    <td>{customer.detailLine1}</td>
                    <td>{customer.detailLine2}</td>
                    <td>{customer.detailLine3}</td>
                    <td>{customer.contactName}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Belum ada customer.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
