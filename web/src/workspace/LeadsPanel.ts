```text
export interface LeadItem {
  id: string;
  project_id: string;
  place_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  fit_score: number;
  outreach_status: string;
  tailored_pitch: string | null;
  last_contacted_at: string | null;
}

export class LeadsPanel {
  constructor(
    private readonly container: HTMLElement,
    private readonly getBaseUrl: () => string,
    private readonly getProjectId: () => string,
    private readonly onStateChanged?: () => Promise<void> | void
  ) {}

  public async refresh(statusFilter = ""): Promise<void> {
    const projectId = this.getProjectId().trim();
    if (!projectId) {
      this.container.innerHTML = `<p style="font-size:12px;color:#555;">Select or create a project to view leads.</p>`;
      return;
    }

    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    const res = await fetch(
      `${this.getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/leads${query}`
    );

    if (!res.ok) {
      this.container.innerHTML = `<p style="font-size:12px;color:#a32626;">Failed to load leads (${res.status}).</p>`;
      return;
    }

    const data = (await res.json()) as { leads?: LeadItem[] };
    this.render(data.leads ?? []);
  }

  private render(leads: LeadItem[]): void {
    if (leads.length === 0) {
      this.container.innerHTML = `<p style="font-size:12px;color:#555;">No leads found for this project yet.</p>`;
      return;
    }

    this.container.innerHTML = "";

    for (const lead of leads) {
      const box = document.createElement("div");
      box.style.cssText =
        "border:1px solid #dfd6c5;border-radius:8px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:8px;font-size:12px;";

      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;gap:8px;font-weight:700;";
      header.innerHTML = `<span>${this.escapeHtml(lead.place_name)}</span><span>Score ${lead.fit_score.toFixed(2)} · ${this.escapeHtml(lead.outreach_status)}</span>`;

      const meta = document.createElement("div");
      meta.style.cssText = "color:#555;";
      meta.textContent = [lead.category, lead.address, lead.email || lead.phone].filter(Boolean).join(" · ");

      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.style.cssText = "width:100%;font:inherit;padding:6px;border-radius:6px;border:1px solid #dfd6c5;";
      textarea.value = lead.tailored_pitch || "";

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

      const approveBtn = document.createElement("button");
      approveBtn.textContent = "Approve & Queue";
      approveBtn.style.cssText =
        "padding:6px 10px;border:none;border-radius:6px;background:#1e3a2f;color:#fff;cursor:pointer;font-weight:600;";
      approveBtn.addEventListener("click", async () => {
        await this.postAction(lead.id, "approve", {
          tailoredPitch: textarea.value,
          dispatchNow: true,
        });
      });

      const repliedBtn = document.createElement("button");
      repliedBtn.textContent = "Mark Replied & Distill";
      repliedBtn.style.cssText =
        "padding:6px 10px;border:none;border-radius:6px;background:#c86d3b;color:#fff;cursor:pointer;font-weight:600;";
      repliedBtn.addEventListener("click", async () => {
        await this.postAction(lead.id, "outcome", {
          outcome: "replied",
          notes: "Positive response on tailored product & group order offer",
        });
      });

      const rejectedBtn = document.createElement("button");
      rejectedBtn.textContent = "Reject & Distill";
      rejectedBtn.style.cssText =
        "padding:6px 10px;border:1px solid #ccc;border-radius:6px;background:#f7f5f0;color:#222;cursor:pointer;";
      rejectedBtn.addEventListener("click", async () => {
        await this.postAction(lead.id, "outcome", {
          outcome: "rejected",
          notes: "Not a fit at this time",
        });
      });

      actions.append(approveBtn, repliedBtn, rejectedBtn);
      box.append(header, meta, textarea, actions);
      this.container.appendChild(box);
    }
  }

  private async postAction(
    leadId: string,
    action: "approve" | "outcome",
    body: Record<string, unknown>
  ): Promise<void> {
    const projectId = this.getProjectId().trim();
    if (!projectId) return;

    await fetch(
      `${this.getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/leads/${encodeURIComponent(leadId)}/${action}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    await this.refresh();
    if (this.onStateChanged) {
      await this.onStateChanged();
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
