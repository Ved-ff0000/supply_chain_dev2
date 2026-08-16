/**
 * Shipment Events & Chronological Timeline View
 */

const EventsView = {
  async render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Shipment Events & Audit Trail</h1>
          <p style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">Chronological milestone event logs linked to freight status transitions.</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="refresh-events-btn">${Icons.refresh} Refresh Log</button>
      </div>

      <div class="card" style="padding: 0; overflow: hidden; margin-top: 16px;">
        <div class="table-wrapper" style="border: none;">
          <table class="data-table" id="events-table">
            <thead>
              <tr>
                <th>Event Time</th>
                <th>Shipment / Tracking</th>
                <th>Milestone Status</th>
                <th>Location</th>
                <th>Event Description</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" style="text-align: center; color: var(--text-tertiary); padding: 40px;">Loading event history...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("refresh-events-btn")?.addEventListener("click", () => {
      this.loadEvents();
    });

    await this.loadEvents();
  },

  async loadEvents() {
    try {
      const shipments = Store.getState().shipments;
      const sampleEvents = [
        { id: 201, event_time: new Date(Date.now() - 3600000 * 2).toISOString(), tracking_number: "DHL-984210", status: "IN_TRANSIT", location: "Hong Kong Air Cargo Hub", description: "Consignment departed origin sorting hub on flight CX882." },
        { id: 202, event_time: new Date(Date.now() - 3600000 * 5).toISOString(), tracking_number: "FDX-441092", status: "CUSTOMS_HOLD", location: "Rotterdam Customs Terminal", description: "Package held for statutory EU VAT document inspection." },
        { id: 203, event_time: new Date(Date.now() - 3600000 * 8).toISOString(), tracking_number: "UPS-772901", status: "DELAYED", location: "Incheon International Gateway", description: "Auto-transitioned by delay detection engine due to port congestion." },
        { id: 204, event_time: new Date(Date.now() - 86400000).toISOString(), tracking_number: "DHL-552918", status: "DELIVERED", location: "London Heathrow Logistics Park", description: "Delivered and electronic proof-of-delivery captured." }
      ];

      this.renderTable(sampleEvents);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  },

  renderTable(events) {
    const tbody = document.querySelector("#events-table tbody");
    if (!tbody) return;

    tbody.innerHTML = events.map(e => `
      <tr>
        <td class="font-mono" style="font-size: 12px; color: var(--text-tertiary);">
          ${new Date(e.event_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </td>
        <td class="font-mono td-strong" style="color: var(--primary);">${e.tracking_number}</td>
        <td>
          <span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>
        </td>
        <td>${e.location || "En Route"}</td>
        <td style="font-size: 12px; color: var(--text-secondary);">${e.description}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Soft delete event">
            ${Icons.trash}
          </button>
        </td>
      </tr>
    `).join("");
  }
};
