# API budgeting read-only

Endpoint untuk piutang invoice customer dan hutang nota supplier, menggunakan schema
`invoice_documents`/`invoice_items` dan `supplier_notes`/`supplier_note_items` yang ada.
Tidak membuat invoice, mengubah pembayaran, mengunduh lampiran, atau mengakses Finance.
Tidak ada migration. Implementasi lokal tidak mengaktifkan endpoint production.

## Autentikasi dan aktivasi

Administrator deployment nantinya mengatur dua environment variable server:

- `BUDGETING_API_TOKEN_SHA256`: digest SHA-256 hex token acak (minimal 32 byte,
  base64url 43 karakter; maksimal 256 karakter).
- `BUDGETING_API_TOKEN_EXPIRES_AT`: tanggal kedaluwarsa ISO-8601 UTC eksplisit.

Client mengirim `Authorization: Bearer <token>` melalui HTTPS. Simpan token mentah
di secret client yang terlindungi. Jangan masukkan ke URL, sel spreadsheet, Git,
chat, log, atau variable `NEXT_PUBLIC_*`. Token ini terpisah dari token supplier
yang memiliki izin tulis, `AUTH_SECRET`, dan credential database.

Tidak ada akses publik atau fallback cookie browser. Konfigurasi kosong/salah,
token salah, dan token kedaluwarsa menghasilkan 401. Token valid dengan method
atau path budgeting di luar scope menghasilkan 403. Token budgeting tidak memberi
akses ke endpoint tulis supplier, invoice, Finance, download file, atau admin.
Untuk rotasi, ganti hash server dan token client; cabut dengan menghapus hash atau
mengakhiri masa berlakunya. Response data/error memakai `Cache-Control: no-store`.

## Endpoint

| GET | Isi |
| --- | --- |
| `/api/budgeting/invoices` | Daftar invoice customer tersimpan beserta item |
| `/api/budgeting/invoices/{id}` | Detail satu invoice beserta item |
| `/api/budgeting/supplier-notes` | Daftar nota supplier import/manual beserta item |
| `/api/budgeting/supplier-notes/{id}` | Detail satu nota beserta item |

Invoice mengikuti eligibility halaman invoice: SPH `menunggu_pengiriman`,
`proses_pengiriman`, `selesai`, termasuk alias historis `invoiced`/`pending_invoice`.
SPH eligible tanpa invoice tersimpan tidak ditampilkan atau dibuat oleh API ini.
Nomor sintetis dari halaman ledger bukan ID dokumen detail. Nota cancelled tetap
tersedia agar bisa ditelusuri; filter status untuk kebutuhan budgeting.

## Parameter daftar

| Parameter | Aturan |
| --- | --- |
| `page` | Default 1, integer 1–1.000.000 |
| `pageSize` | Default 100, integer 1–200 |
| `dateFrom`, `dateTo` | Periode inklusif `invoiceDate` atau `noteDate` |
| `dueFrom`, `dueTo` | Periode inklusif `dueDate` efektif; tanggal kosong tidak cocok |
| `asOf` | Tanggal analisis aging; default tanggal hari ini WIB |
| `paymentStatus` | `BELUM BAYAR`, `DP`, `LUNAS`, `CANCELLED` |
| `dueStatus` | `overdue`, `on_due`, `upcoming`, `no_due_date`, `settled`, `cancelled` |
| `customerId` | Hanya invoice; ID customer dari SPH, nullable untuk data historis |
| `supplierId` | Hanya nota supplier |

Semua tanggal `YYYY-MM-DD`. Parameter tidak dikenal, berulang, tanggal tidak valid,
rentang terbalik, atau filter identitas yang tidak sesuai menghasilkan 400.
Detail hanya menerima `asOf`; ID tidak ditemukan/tidak eligible menghasilkan 404.
Kegagalan database menghasilkan 500 dengan pesan generik tanpa credential.

Urutan daftar: tanggal dokumen descending, lalu ID ascending. Response daftar:

```json
{
  "data": [],
  "pagination": {
    "page": 1, "pageSize": 100, "total": 0,
    "totalPages": 0, "hasNextPage": false
  },
  "asOf": "2026-10-04",
  "timeZone": "Asia/Jakarta"
}
```

Detail mengembalikan `{data: {...}, asOf, timeZone}`. Halaman kosong tetap 200.
Pagination memakai offset: perubahan dokumen saat pengambilan beberapa halaman
dapat menggeser hasil. Untuk refresh spreadsheet, ambil semua halaman, deduplikasi
berdasarkan `id`, dan ganti dataset setelah semua request berhasil. Bukan snapshot
transaksional lintas request.

## Field dan perhitungan

Semua nominal angka IDR tanpa format; quantity supplier dapat pecahan.
Field umum: `id`, `documentDate`, `totalAmount`, `paidAmount`, `remainingPayment`,
`paymentStatus`, `paymentTerm`, `dueDate`, `paymentDate`, `createdAt`, `updatedAt`,
`currency: "IDR"`, `items`, serta field aging di bawah.

Invoice: `invoiceNo`, `invoiceDate`, `sphId`, `sphNo`, `ttbId`, `poNo`,
`customerId`, `customerCode`, `customerName` (snapshot invoice),
`paymentDueDate` (nilai tersimpan), `status` (status dokumen asli), `processedAt`.
`paymentDate` adalah 10 karakter pertama `processedAt`, mengikuti ledger existing;
bukan riwayat semua cicilan. Item: `id`, `documentId`, `sphItemId`, `lineNo`,
`partNumber`, `partName`, `quantity`, `uom`, `unitPrice`, `totalPrice`.

Nota supplier: `noteNo`, `noteDate`, `noteSource`, `supplierId`, `supplierName`,
`customerName` (teks tersimpan, bukan ID customer), `purchasePurpose`, `category`,
`flag`, `itemSummary`, `amount` (alias nilai asli `totalAmount`),
`storedRemainingPayment`, `paymentDeadline` (nilai tersimpan), `paymentDate`.
Item: `id`, `documentId`, `lineNo`, `partNumber`, `description`, `quantity`,
`uom`, `unitPrice`, `totalPrice`, `dueDate`, `status`, `shortCode`, `flag`.
Due date item ditampilkan untuk analisis item; aging dokumen memakai deadline nota.

`remainingPayment` dihitung `max(totalAmount - paidAmount, 0)`; dokumen cancelled
atau sudah lunas (`done` invoice, `LUNAS` nota) bernilai 0 untuk budgeting.
`storedRemainingPayment` membantu mendeteksi selisih data nota lama; total dokumen
tetap nilai tersimpan, tidak dipaksa sama dengan jumlah item. `paidAmount` asli
tetap ditampilkan, termasuk data historis yang melebihi total. Status invoice
dinormalisasi: cancelled → `CANCELLED`, done atau total positif yang sudah terbayar
→ `LUNAS`, pembayaran parsial → `DP`, sisanya → `BELUM BAYAR`. Status nota memakai
`paymentStatus` asli.

Due date efektif invoice: `paymentDueDate` invoice → `paymentDueDate` SPH →
`invoiceDate + TOP n` dari payment term, atau invoiceDate untuk term selain TOP.
Perhitungan tanggal memakai tanggal kalender SQLite agar tidak bergantung zona
waktu server. Nota memakai `paymentDeadline`; kosong menghasilkan `null`.
Tidak ada estimasi deadline supplier dari term atau item.

`asOf` hanya mengevaluasi aging **saldo pembayaran saat ini**, bukan rekonstruksi
saldo historis pada tanggal tersebut. Tidak tersedia daftar riwayat cicilan pada
schema dokumen ini. Aging: cancelled → `cancelled`; saldo nol → `settled`;
deadline kosong → `no_due_date`; deadline sebelum/sama/setelah asOf →
`overdue`/`on_due`/`upcoming`. `isOverdue`, `isOnDue`, `daysPastDue` (minimal 0),
`daysUntilDue` (minimal 0, null bila settled/cancelled/tidak ada deadline) dan
`asOf` disertakan per dokumen. Jangan masukkan cancelled/lunas ke proyeksi arus kas.

Tidak mengembalikan base64/PDF, URL file eksternal, extraction payload,
idempotency key/hash, rekening, alamat, telepon, atau credential.

## Contoh request

```js
// Node; isi environment client dari secret lokal. Tidak mencetak token/data.
const base = new URL(process.env.MPM_BUDGETING_BASE_URL);
if (base.protocol !== 'https:') throw new Error('HTTPS required');
const url = new URL('/api/budgeting/invoices', base);
url.search = new URLSearchParams({
  dateFrom: '2026-10-01', dateTo: '2026-10-31',
  dueStatus: 'overdue', asOf: '2026-10-04', pageSize: '200'
});
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.MPM_BUDGETING_TOKEN}` },
  redirect: 'error'
});
if (!response.ok) throw new Error(`Budgeting API HTTP ${response.status}`);
const result = await response.json();
```

Untuk hutang jatuh tempo hari ini:
`/api/budgeting/supplier-notes?dueStatus=on_due&asOf=2026-10-04`.
Untuk detail: `/api/budgeting/invoices/{id}?asOf=2026-10-04`.

## Contoh integrasi Google Sheets (untuk pekerjaan terpisah)

`IMPORTDATA`/`IMPORTXML` tidak menyediakan header Bearer yang diperlukan API ini.
Gunakan Apps Script pada spreadsheet privat atau layanan perantara yang melakukan
autentikasi. Jangan buat proxy publik. Contoh berikut hanya dokumentasi; tidak
memasang script atau mengedit spreadsheet.

Simpan `MPM_BUDGETING_BASE_URL` (origin HTTPS) dan `MPM_BUDGETING_TOKEN` di
Script Properties. Semua editor project Apps Script harus dipercaya karena dapat
mengakses secret dan semua dokumen pada scope token. Untuk berbagi sheet dengan
pihak lain, tempatkan credential pada layanan terpisah yang membatasi akses.

```js
// Contoh fungsi kustom: =MPM_BUDGETING("supplier-notes";"2026-10-04";"on_due")
// Kirim asOf sebagai string YYYY-MM-DD. Delimiter formula mengikuti locale sheet.
function MPM_BUDGETING(type, asOf, dueStatus) {
  if (!['invoices', 'supplier-notes'].includes(type)) throw new Error('Jenis dokumen salah');
  const properties = PropertiesService.getScriptProperties();
  const base = properties.getProperty('MPM_BUDGETING_BASE_URL');
  const token = properties.getProperty('MPM_BUDGETING_TOKEN');
  if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?$/.test(base || '') || !token) {
    throw new Error('Konfigurasi API belum tersedia');
  }
  const result = [['id', 'nomor', 'tanggal', 'pihak', 'dueDate', 'total', 'terbayar',
    'sisa', 'paymentStatus', 'dueStatus', 'daysPastDue']];
  const seen = new Set();
  for (let page = 1; page <= 100; page++) {
    const url = base.replace(/\/$/, '') + '/api/budgeting/' + type +
      '?pageSize=200&page=' + page + '&asOf=' + encodeURIComponent(asOf) +
      (dueStatus ? '&dueStatus=' + encodeURIComponent(dueStatus) : '');
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      followRedirects: false, muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Budgeting API HTTP ' + response.getResponseCode());
    }
    const body = JSON.parse(response.getContentText());
    for (const d of body.data) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      // Prevent document text from being interpreted as a spreadsheet formula.
      const text = v => /^[=+@-]/.test(String(v || '')) ? "'" + v : String(v || '');
      result.push([text(d.id), text(d.invoiceNo || d.noteNo), d.documentDate,
        text(d.customerName && type === 'invoices' ? d.customerName : d.supplierName),
        d.dueDate || '', d.totalAmount, d.paidAmount, d.remainingPayment,
        d.paymentStatus, d.dueStatus, d.daysPastDue]);
    }
    if (!body.pagination.hasNextPage) return result;
  }
  throw new Error('Terlalu banyak halaman; persempit filter pada integrasi');
}
```

Contoh Apps Script harus disesuaikan volume dan quota: fungsi kustom dapat timeout
dan perubahan di dashboard tidak otomatis memicu kalkulasi ulang. Untuk refresh
terjadwal/volume besar, gunakan proses berotorisasi yang mengambil semua halaman
dengan filter periode, menyimpan snapshot, lalu menulis dataset sekali setelah
seluruh pengambilan berhasil. Rincian item tersedia melalui `data[].items` untuk
tab item terpisah dengan join `documentId`; jangan menjumlahkan total dokumen pada
setiap baris item karena akan menggandakan total.

## Verifikasi lokal

`npm run test:budgeting-api` memakai SQLite in-memory terisolasi, menguji auth/proxy,
query SQL, filter, pagination, detail/404, projection data privat, DP/lunas/cancelled,
aging, error generik, dan kesamaan snapshot sebelum/sesudah pembacaan.
Tidak membutuhkan credential database, sync, atau akses production.
