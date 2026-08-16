/**
 * ETA Prediction & Transit Time Breakdown Modal
 */

const EtaModal = {
  async open(shipmentId) {
    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    if (!modalRoot || !backdropEl) return;

    modalRoot.classList.add("active");
    backdropEl.classList.add("active");

    modalRoot.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--primary); display: flex;">${Icons.clock}</span>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">ETA Prediction Engine</h3>
        </div>
        <button class="btn btn-secondary btn-icon" id="close-modal-btn">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div style="padding: 40px; text-align: center; color: var(--text-tertiary);">
          <p>Analyzing historical transit telemetry for shipment #${shipmentId}...</p>
        </div>
      </div>
    `;

    document.getElementById("close-modal-btn")?.addEventListener("click", () => this.close());

    // Fetch real prediction from API
    try {
      const res = await API.request(`/shipments/${shipmentId}/eta`);
      if (res && res.success) {
        this.renderContent(res);
      } else {
        throw new Error(res.message || "Failed to load ETA");
      }
    } catch (err) {
      modalRoot.querySelector(".modal-body").innerHTML = `
        <div style="color: var(--danger); text-align: center; padding: 20px;">
          <p>Failed to calculate ETA: ${err.message}</p>
        </div>
      `;
    }
  },

  renderContent(data) {
    const modalRoot = document.getElementById("modal-root");
    const p = data.prediction || {};

    const confidencePct = Math.round((p.confidence_score || 0.85) * 100);
    const riskLevel = p.delay_risk || "NONE";
    const riskClass = `risk-${riskLevel.toLowerCase()}`;

    modalRoot.querySelector(".modal-body").innerHTML = `
      <div class="eta-breakdown-card">
        <div class="eta-highlight-banner">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary);">Predicted Arrival</div>
            <div class="eta-big-date">${new Date(p.predicted_eta || Date.now()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Tracking #: <span class="font-mono" style="color: var(--primary); font-weight: 600;">${data.tracking_number}</span></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary);">Delay Risk</div>
            <span class="badge ${riskClass}" style="margin-top: 4px; font-size: 12px; padding: 4px 10px;">${riskLevel} RISK</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div style="background-color: var(--bg-surface); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700;">Prediction Model Tier</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">${p.tier_used || "CARRIER_ROUTE_AVERAGE"}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">Based on ${p.sample_size || 30}+ past completed runs</div>
          </div>

          <div style="background-color: var(--bg-surface); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700;">Confidence Score</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
              <span class="metric-main-num" style="font-size: 20px;">${confidencePct}%</span>
              <span class="badge badge-delivered">High Accuracy</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill success" style="width: ${confidencePct}%;"></div>
            </div>
          </div>
        </div>

        <div style="background-color: var(--bg-surface); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Transit Analysis & Route Telemetry</div>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
            Route: <strong>${data.route || "Origin -> Destination"}</strong><br/>
            Carrier: <strong>${data.carrier || "Primary Freight Carrier"}</strong><br/>
            Estimated Transit Time: <strong>${p.estimated_transit_hours || 48} hours</strong>
            ${p.hours_behind_schedule > 0 ? `<br/><span style="color: var(--danger); font-weight: 600;">⚠ Running ${p.hours_behind_schedule} hours behind normal schedule threshold.</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  close() {
    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    modalRoot?.classList.remove("active");
    backdropEl?.classList.remove("active");
  }
};
