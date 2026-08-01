import type { ReactNode } from "react";

type CustomerRow = {
  id: string | number;
  code: string;
  name: string;
  detailLine1: string;
  detailLine2: string;
  detailLine3: string;
  contactName: string;
};

type CustomerFormProps = {
  action?: (formData: FormData) => Promise<void>;
  customer?: CustomerRow;
  customers: CustomerRow[];
  showForm?: boolean;
  showList?: boolean;
  listControls?: ReactNode;
  pagination?: ReactNode;
  title?: string;
};

export function CustomerForm({
  action,
  customer,
  customers,
  listControls,
  pagination,
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
          {customer ? <input name="id" type="hidden" value={customer.id} /> : null}

          <label>
            <span>Kode Customer</span>
            <input
              name="code"
              required
              defaultValue={customer?.code ?? ""}
              placeholder="AJB"
              maxLength={12}
            />
          </label>

          <label>
            <span>Nama Customer</span>
            <input
              name="name"
              required
              defaultValue={customer?.name ?? ""}
              placeholder="PT Albar Jaya Bersama"
            />
          </label>

          <label>
            <span>Franco / Detail 1</span>
            <input
              name="detailLine1"
              required
              defaultValue={customer?.detailLine1 ?? ""}
              placeholder="Kendari"
            />
          </label>

          <label>
            <span>Provinsi / Detail 2</span>
            <input
              name="detailLine2"
              required
              defaultValue={customer?.detailLine2 ?? ""}
              placeholder="Sulawesi Tenggara"
            />
          </label>

          <label>
            <span>Detail 3</span>
            <input
              name="detailLine3"
              defaultValue={customer?.detailLine3 ?? ""}
              placeholder="Up Ibu Rahba"
            />
          </label>

          <label>
            <span>PIC</span>
            <input
              name="contactName"
              defaultValue={customer?.contactName ?? ""}
              placeholder="Ibu Rahba"
            />
          </label>

          <button type="submit">{customer ? "Simpan customer" : "Buat customer"}</button>
        </form>
      ) : null}

      {showList ? (
        <>
          {listControls}
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
                  <th>Action</th>
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
                      <td>
                        <div className="table-actions">
                          <a href={`/customer/edit-customer/${customer.id}`}>Edit</a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>Tidak ada customer sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination}
        </>
      ) : null}
    </section>
  );
}
