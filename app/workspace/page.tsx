import { AppShell } from "../components/AppShell";
import workspaceLinks from "../../config/workspace-links.json";

export default function WorkspacePage() {
  return (
    <AppShell>
      <div className="workspace-page">
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Workspace</p>
              <h1>Shortcut Dokumen</h1>
              <p>Akses cepat ke todo list dan folder kerja utama.</p>
            </div>
          </div>
        </section>

        <section className="workspace-card-grid" aria-label="Workspace links">
          {workspaceLinks.map((item) => (
            <article className="workspace-card" key={item.href}>
              <div>
                <span>{item.type}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <a
                className="primary-button workspace-card-action"
                href={item.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
