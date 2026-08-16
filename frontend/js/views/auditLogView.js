/**
 * Administrative Audit Trail View
 */

const AuditLogView = {
  async render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">System Audit Trail & Immutable Log</h1>
          <p style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">Comprehensive tracking of shipment mutations, user privilege escalations, and soft deletions.</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="refresh-audit-btn">${Icons.refresh} Refresh Audit Feed</button>
      </div>

      <div class="card" style="padding: 0; overflow: hidden; margin-top: 16px;">
        <div class="table-wrapper" style="border: none;">
          <table class="data-table" id="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Action</th>
                <th>Changed By</th>
                <th>Snapshot Diffs</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" style="text-align: center; color: var(--text-tertiary); padding: 40px;">Loading audit logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("refresh-audit-btn")?.addEventListener("click", () => {
      this.loadAuditLogs();
    });

    await this.loadAuditLogs();
  },

  async loadAuditLogs() {
    try {
      const res = await API.request("/audit-log");
      const logs = res?.data || [];
      Store.setState({ auditLogs: logs });
      this.renderTable(logs);
    } catch (err) {
      console.error("Audit log load error:", err);
    }
  },

  renderTable(logs) {
    const tbody = document.querySelector("#audit-table tbody");
    if (!tbody) return;

    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-tertiary); padding: 40px;">No audit events recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="font-mono" style="font-size: 11px; color: var(--text-tertiary);">
          ${new Date(l.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </td>
        <td>
          <span class="badge badge-created">${l.entity_type}</span>
        </td>
        <td class="font-mono td-strong">#${l.entity_id}</td>
        <td>
          <span class="badge ${l.action.includes('DELETE') ? 'risk-critical' : l.action.includes('STATUS') ? 'badge-in-transit' : 'badge-delivered'}">
            ${l.action}
          </span>
        </td>
        <td style="font-size: 12px;">User #${l.changed_by || "System Daemon"}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-inspect-diff" data-id="${l.id}">
            ${Icons.eye} Inspect JSON Diff
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-inspect-diff").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const log = Store.getState().auditLogs.find(item => item.id === id);
        if (log) {
          AuditDiffModal.open(log);
        }
      });
    });
  }
};
