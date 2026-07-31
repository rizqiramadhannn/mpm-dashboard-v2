import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { listSupplierNotes } from "../notes/data";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatFileSize(value: number) {
  if (!value) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export default async function SupplierNotesPage() {
  const notes = await listSupplierNotes();

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Supplier</p>
            <h1>List Nota Supplier</h1>
          </div>
        </div>

        <div className="customer-table-wrap">
          <table className="customer-table supplier-note-table">
            <thead>
              <tr>
                <th>No Nota</th>
                <th>Tanggal</th>
                <th>Supplier</th>
                <th>Flag</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Item</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {notes.length > 0 ? (
                notes.map((note) => (
                  <tr key={note.id}>
                    <td>
                      <strong className="table-primary">{note.noteNo}</strong>
                    </td>
                    <td>{formatDate(note.noteDate)}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{note.supplierName}</strong>
                        <span>{note.category}</span>
                      </div>
                    </td>
                    <td>{note.flag}</td>
                    <td>{formatRupiah(note.amount)}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{note.paymentStatus}</strong>
                        <span>
                          Sisa {formatRupiah(note.remainingPayment)}
                          {note.paymentDeadline
                            ? ` / Jatuh tempo ${formatDate(note.paymentDeadline)}`
                            : ""}
                        </span>
                      </div>
                    </td>
                    <td>
                      <details className="item-preview">
                        <summary>{note.items.length} item</summary>
                        <div>
                          {note.items.map((item) => (
                            <p key={item.id}>
                              <span>{item.lineNo}.</span> {item.partNumber || "-"} -{" "}
                              {item.description} ({item.quantity} {item.uom} x{" "}
                              {formatRupiah(item.unitPrice)})
                            </p>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td>
                      {note.sourceFileName ? (
                        <div className="table-actions icon-actions">
                          <Link
                            aria-label={`Download ${note.sourceFileName}`}
                            className="icon-action"
                            href={`/supplier/nota-supplier/download/${note.id}`}
                            title={`Download ${note.sourceFileName}`}
                          >
                            <DownloadIcon />
                          </Link>
                          <span className="file-meta">
                            {note.sourceFileName}
                            {note.sourceFileSize
                              ? ` (${formatFileSize(note.sourceFileSize)})`
                              : ""}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Belum ada nota supplier.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
