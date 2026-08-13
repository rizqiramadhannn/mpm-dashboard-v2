import type { ReactNode } from "react";
import { ConfirmForm } from "../../components/ConfirmForm";
import { defaultPaymentTerm, paymentTermOptions } from "../../components/paymentTerms";

type CustomerRow = {
  id: string | number;
  code: string;
  name: string;
  detailLine1: string;
  detailLine2: string;
  detailLine3: string;
  contactName: string;
  phone: string;
  defaultPaymentTerm: string;
  monthlyCreditLimit: number;
  sphCreditLimit: number;
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

function formatMoney(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");

  if (!digits) {
    return "";
  }

  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : `62${digits}`;

  return /^62[1-9]\d{7,14}$/.test(normalized) ? `https://wa.me/${normalized}` : "";
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M21 11.5a8.4 8.4 0 0 1-9 8.3 8.7 8.7 0 0 1-3.9-.9L3 20l1.2-4.8A8 8 0 0 1 3 11.5a8.5 8.5 0 0 1 18 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 10.5h8M8 14h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

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
        <ConfirmForm
          action={action}
          className="customer-form"
          confirmMessage={
            customer
              ? "Simpan perubahan customer ini?"
              : "Buat customer baru dengan data ini?"
          }
        >
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
            <span>Kontak / PIC</span>
            <input
              name="contactName"
              defaultValue={customer?.contactName ?? ""}
              placeholder="Ibu Rahba"
            />
          </label>

          <label>
            <span>Nomor HP</span>
            <input
              name="phone"
              defaultValue={customer?.phone ?? ""}
              inputMode="tel"
              pattern="(\\+?62|0)[0-9\\s-]{8,16}"
              placeholder="08xxxxxxxxxx"
              title="Masukkan nomor HP Indonesia, contoh 085212345678 atau +6285212345678"
            />
          </label>

          <label>
            <span>Payment Term</span>
            <select
              name="defaultPaymentTerm"
              required
              defaultValue={customer?.defaultPaymentTerm || defaultPaymentTerm}
            >
              {paymentTermOptions.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Limit Bulanan</span>
            <input
              name="monthlyCreditLimit"
              required
              defaultValue={customer?.monthlyCreditLimit ?? 15_000_000}
              inputMode="numeric"
              placeholder="15.000.000"
            />
          </label>

          <label>
            <span>Limit Per SPH</span>
            <input
              name="sphCreditLimit"
              required
              defaultValue={customer?.sphCreditLimit ?? 0}
              inputMode="numeric"
              placeholder="0"
            />
          </label>

          <button type="submit">{customer ? "Simpan customer" : "Buat customer"}</button>
        </ConfirmForm>
      ) : null}

      {showList ? (
        <>
          {listControls}
          <div className="customer-table-wrap">
            <table className="customer-table" data-sortable-table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Customer</th>
                  <th>Detail 1</th>
                  <th>Detail 2</th>
                  <th>Detail 3</th>
                  <th>Kontak / PIC</th>
                  <th>Nomor HP</th>
                  <th>Payment Term</th>
                  <th>Limit Bulanan</th>
                  <th>Limit Per SPH</th>
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
                      <td>{customer.phone || "-"}</td>
                      <td>{customer.defaultPaymentTerm}</td>
                      <td>{formatMoney(customer.monthlyCreditLimit)}</td>
                      <td>
                        {customer.sphCreditLimit > 0
                          ? formatMoney(customer.sphCreditLimit)
                          : "Tidak ada limit"}
                      </td>
                      <td>
                        <div className="table-actions">
                          {whatsappUrl(customer.phone) ? (
                            <a
                              aria-label={`Chat ${customer.name}`}
                              className="icon-action success"
                              href={whatsappUrl(customer.phone)}
                              rel="noopener noreferrer"
                              target="_blank"
                              title={`Chat ${customer.name}`}
                            >
                              <MessageIcon />
                            </a>
                          ) : null}
                          <a href={`/customer/edit-customer/${customer.id}`}>Edit</a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11}>Tidak ada customer sesuai filter.</td>
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
