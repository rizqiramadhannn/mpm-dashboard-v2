import { AppShell } from "../components/AppShell";

const workspaceLinks = [
  {
    description: "Google Sheet untuk daftar pekerjaan dan follow up.",
    href: "https://docs.google.com/spreadsheets/d/17qN6D0PGfeKQryk2cDFzEcCyEOrdqjkZ2Y9WzvOn3_Q/edit?usp=drivesdk",
    label: "Buka Todo List",
    title: "Todo List",
    type: "Google Sheet",
  },
  {
    description: "Folder Google Drive utama untuk dokumen MPM.",
    href: "https://drive.google.com/drive/folders/1PoiRTw0QZWAPVr5W7UFSItEAToMdITRN?usp=drive_link",
    label: "Buka Drive MPM",
    title: "GDrive MPM",
    type: "Google Drive",
  },
  {
    description: "Folder Google Drive untuk dokumen Roda.",
    href: "https://drive.google.com/drive/folders/12hnjyDsjoOTqCjWeW6y3btqugQpcfO9F?usp=drive_link",
    label: "Buka Drive Roda",
    title: "GDrive Roda",
    type: "Google Drive",
  },
];

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
