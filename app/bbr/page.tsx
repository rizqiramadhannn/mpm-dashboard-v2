import Link from "next/link";
import { AppShell } from "../components/AppShell";

export default function BbrPage() {
  return (
    <AppShell>
      <div className="workspace-page">
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="page-kicker">BBR</p>
              <h1>Workspace BBR</h1>
              <p>Akses cepat untuk tools BBR.</p>
            </div>
          </div>
        </section>

        <section className="workspace-card-grid" aria-label="BBR tools">
          <article className="workspace-card">
            <div>
              <span>Tool</span>
              <h2>CALCULATOR</h2>
              <p>Hitung margin penawaran.</p>
            </div>
            <Link className="primary-button workspace-card-action" href="/bbr/calculator">
              Buka Calculator
            </Link>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
