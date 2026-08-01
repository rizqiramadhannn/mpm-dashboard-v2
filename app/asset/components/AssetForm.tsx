import { ConfirmForm } from "../../components/ConfirmForm";

type AssetFormValues = {
  acquisitionDate?: string | null;
  assetCode?: string;
  assetValue?: number;
  category?: string;
  condition?: string;
  currentOrLastPic?: string;
  id?: string;
  itemName?: string;
  location?: string;
  notes?: string;
  status?: string;
};

type AssetFormProps = {
  action: (formData: FormData) => Promise<void>;
  asset?: AssetFormValues;
  submitLabel: string;
  title: string;
};

export function AssetForm({ action, asset, submitLabel, title }: AssetFormProps) {
  return (
    <section className="customer-page">
      <div className="dashboard-header">
        <div>
          <p className="page-kicker">Operasional</p>
          <h1>{title}</h1>
        </div>
      </div>

      <ConfirmForm
        action={action}
        className="payment-request-form asset-form"
        confirmMessage={asset?.id ? "Simpan perubahan asset ini?" : "Buat asset baru dengan data ini?"}
      >
        {asset?.id ? <input name="id" type="hidden" value={asset.id} /> : null}
        <label>
          <span>Kode Asset</span>
          <input
            name="assetCode"
            required
            placeholder="AST-0001"
            defaultValue={asset?.assetCode ?? ""}
          />
        </label>
        <label>
          <span>Nama Barang</span>
          <input
            name="itemName"
            required
            placeholder="Laptop Admin"
            defaultValue={asset?.itemName ?? ""}
          />
        </label>
        <label>
          <span>Kategori</span>
          <input
            name="category"
            placeholder="Elektronik / kendaraan"
            defaultValue={asset?.category ?? ""}
          />
        </label>
        <label>
          <span>Nilai Barang</span>
          <input
            inputMode="numeric"
            name="assetValue"
            required
            placeholder="8500000"
            defaultValue={asset?.assetValue ?? ""}
          />
        </label>
        <label>
          <span>PIC Saat Ini / Terakhir</span>
          <input
            name="currentOrLastPic"
            placeholder="Nama PIC"
            defaultValue={asset?.currentOrLastPic ?? ""}
          />
        </label>
        <label>
          <span>Lokasi Barang</span>
          <input
            name="location"
            required
            placeholder="Kantor / gudang / site"
            defaultValue={asset?.location ?? ""}
          />
        </label>
        <label>
          <span>Kondisi</span>
          <input name="condition" defaultValue={asset?.condition ?? "Baik"} />
        </label>
        <label>
          <span>Status</span>
          <input name="status" defaultValue={asset?.status ?? "Aktif"} />
        </label>
        <label>
          <span>Tanggal Perolehan</span>
          <input
            name="acquisitionDate"
            type="date"
            defaultValue={asset?.acquisitionDate?.slice(0, 10) ?? ""}
          />
        </label>
        <label className="asset-notes-field">
          <span>Catatan</span>
          <input
            name="notes"
            placeholder="Nomor seri, kelengkapan, atau histori"
            defaultValue={asset?.notes ?? ""}
          />
        </label>
        <button type="submit">{submitLabel}</button>
      </ConfirmForm>
    </section>
  );
}
