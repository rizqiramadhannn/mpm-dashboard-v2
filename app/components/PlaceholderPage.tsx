export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="placeholder-page">
      <div className="page-kicker">Penjualan Sparepart</div>
      <h1>{title}</h1>
      <div className="coming-soon">COMING SOON</div>
    </section>
  );
}
