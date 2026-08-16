/**
 * Audit Log JSON Diff Inspector Modal
 */

const AuditDiffModal = {
  open(logEntry) {
    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    if (!modalRoot || !backdropEl) return;

    modalRoot.classList.add("active");
    backdropEl.classList.add("active");

    const oldJson = logEntry.old_value ? JSON.stringify(logEntry.old_value, null, 2) : "// No previous snapshot (CREATE)";
    const newJson = logEntry.new_value ? JSON.stringify(logEntry.new_value, null, 2) : "// Record deleted";

    modalRoot.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--primary); display: flex;">${Icons.audit}</span>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Audit Diff: ${logEntry.entity_type} #${logEntry.entity_id}</h3>
        </div>
        <button class="btn btn-secondary btn-icon" id="close-modal-btn">${Icons.close}</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; color: var(--text-secondary);">
          <span>Action: <strong style="color: var(--text-primary);">${logEntry.action}</strong></span>
          <span>•</span>
          <span>Timestamp: <strong style="color: var(--text-primary); font-family: var(--font-mono);">${new Date(logEntry.created_at).toLocaleString()}</strong></span>
        </div>

        <div class="diff-container">
          <div class="diff-pane">
            <div class="diff-header old">Previous State (old_value)</div>
            <div class="diff-content">${oldJson}</div>
          </div>
          <div class="diff-pane">
            <div class="diff-header new">Updated State (new_value)</div>
            <div class="diff-content">${newJson}</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-diff-btn">Dismiss</button>
      </div>
    `;

    document.getElementById("close-modal-btn")?.addEventListener("click", () => this.close());
    document.getElementById("close-diff-btn")?.addEventListener("click", () => this.close());
  },

  close() {
    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    modalRoot?.classList.remove("active");
    backdropEl?.classList.remove("active");
  }
};
