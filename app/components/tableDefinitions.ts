import type { TableColumn } from "./tablePreferences";

// Column IDs are permanent: retain them when reordering, and give new columns a new ID.
export const TABLE_COLUMNS = {
  "invoices": [
    {
      "id": "c0",
      "label": "NO"
    },
    {
      "id": "c1",
      "label": "TANGGAL"
    },
    {
      "id": "c2",
      "label": "CUSTOMER"
    },
    {
      "id": "c3",
      "label": "NO INVOICE"
    },
    {
      "id": "c4",
      "label": "CATEGORY"
    },
    {
      "id": "c5",
      "label": "OMSET"
    },
    {
      "id": "c6",
      "label": "TERBAYAR"
    },
    {
      "id": "c7",
      "label": "MODAL"
    },
    {
      "id": "c8",
      "label": "ONGKIR"
    },
    {
      "id": "c9",
      "label": "HPP"
    },
    {
      "id": "c10",
      "label": "GP"
    },
    {
      "id": "c11",
      "label": "%GP"
    },
    {
      "id": "c12",
      "label": "PEMBAYARAN"
    },
    {
      "id": "c13",
      "label": "STATUS"
    },
    {
      "id": "c14",
      "label": "JADWAL PEMBAYARAN"
    },
    {
      "id": "c15",
      "label": "TANGGAL BAYAR"
    },
    {
      "id": "c16",
      "label": "AGING"
    },
    {
      "id": "c17",
      "label": "TTD MATERAI"
    },
    {
      "id": "c18",
      "label": "BUKTI BAYAR"
    },
    {
      "id": "c19",
      "label": "ACTION"
    }
  ],
  "sph_list": [
    {
      "id": "c0",
      "label": "No. SPH"
    },
    {
      "id": "c1",
      "label": "Tanggal"
    },
    {
      "id": "c2",
      "label": "Customer"
    },
    {
      "id": "c3",
      "label": "Pengiriman"
    },
    {
      "id": "c4",
      "label": "Payment"
    },
    {
      "id": "c5",
      "label": "Total"
    },
    {
      "id": "c6",
      "label": "Item"
    },
    {
      "id": "c7",
      "label": "Status"
    },
    {
      "id": "c8",
      "label": "Action"
    }
  ],
  "supplier_notes": [
    {
      "id": "c0",
      "label": "Tanggal"
    },
    {
      "id": "c1",
      "label": "No Nota"
    },
    {
      "id": "c2",
      "label": "Supplier"
    },
    {
      "id": "c3",
      "label": "Customer"
    },
    {
      "id": "c4",
      "label": "Flag"
    },
    {
      "id": "c5",
      "label": "Total"
    },
    {
      "id": "c6",
      "label": "Payment"
    },
    {
      "id": "c7",
      "label": "Item"
    },
    {
      "id": "c8",
      "label": "Invoice"
    },
    {
      "id": "c9",
      "label": "Bukti Bayar"
    }
  ],
  "supplier_items": [
    {
      "id": "c0",
      "label": "Tanggal"
    },
    {
      "id": "c1",
      "label": "No Nota"
    },
    {
      "id": "c2",
      "label": "Supplier"
    },
    {
      "id": "c3",
      "label": "Customer"
    },
    {
      "id": "c4",
      "label": "Flag"
    },
    {
      "id": "c5",
      "label": "PN"
    },
    {
      "id": "c6",
      "label": "Deskripsi"
    },
    {
      "id": "c7",
      "label": "Qty"
    },
    {
      "id": "c8",
      "label": "Harga"
    },
    {
      "id": "c9",
      "label": "Total"
    }
  ]
} satisfies Record<string, TableColumn[]>;

export const CONFIGURABLE_TABLE_IDS = ["supplier-notes","supplier-items","sph-list","invoices"];
