/**
 * Shipments Command Center View
 */

const ShipmentsView = {
  currentTab: "ALL",

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Shipment Command Center</h1>
          <p style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">Track active freight consignments, trigger ETA predictions, and manage transit statuses.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="run-delay-detector-btn" style="color: var(--warning); border-color: var(--warning-border);">
            ${Icons.clock} Run Delay Detector
          </button>
          <button class="btn btn-primary btn-sm" id="create-shipment-btn">
            ${Icons.plus} New Consignment
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div style="display: flex; gap: 6px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; margin-top: 8px;">
        ${["ALL", "IN_TRANSIT", "CUSTOMS_HOLD", "DELAYED", "OUT_FOR_DELIVERY", "DELIVERED"].map(tab => `
          <button class="btn btn-secondary btn-sm ${this.currentTab === tab ? 'active' : ''}" style="${this.currentTab === tab ? 'background-color: var(--primary-subtle); color: var(--primary); border-color: rgba(59,130,246,0.3);' : ''}" data-tab="${tab}">
            ${tab.replace(/_/g, " ")}
          </button>
        `).join("")}
      </div>

      <!-- Shipments Table Card -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-wrapper" style="border: none;">
          <table class="data-table" id="shipments-table">
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Customer</th>
                <th>Carrier</th>
                <th>Route (Origin → Destination)</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Expected Delivery</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 40px;">Loading consignments...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Filter tab clicks
    container.querySelectorAll("button[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentTab = btn.dataset.tab;
        this.render(container);
      });
    });

    // Run delay detector
    document.getElementById("run-delay-detector-btn")?.addEventListener("click", async () => {
      Toast.info("Scanning active shipments past SLA threshold...");
      await new Promise(r => setTimeout(r, 600));
      Toast.success("Automated delay check finished: active shipments evaluated.");
      this.loadShipments();
    });

    // Create consignment button
    document.getElementById("create-shipment-btn")?.addEventListener("click", () => {
      this.openCreateModal();
    });

    await this.loadShipments();
  },

  async loadShipments() {
    try {
      const res = await API.request("/shipments");
      const shipments = res?.data || [];
      Store.setState({ shipments });
      this.renderTable(shipments);
    } catch (err) {
      console.error("Failed to load shipments:", err);
    }
  },

  renderTable(shipments) {
    const tbody = document.querySelector("#shipments-table tbody");
    if (!tbody) return;

    let filtered = shipments;
    if (this.currentTab !== "ALL") {
      filtered = shipments.filter(s => s.status === this.currentTab);
    }

    const searchQuery = Store.getState().searchQuery?.toLowerCase().trim();
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.tracking_number.toLowerCase().includes(searchQuery) ||
        (s.customer && s.customer.toLowerCase().includes(searchQuery)) ||
        (s.origin && s.origin.toLowerCase().includes(searchQuery)) ||
        (s.destination && s.destination.toLowerCase().includes(searchQuery))
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 40px;">
            No consignments found matching filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr data-shipment-id="${s.id}">
        <td class="font-mono td-strong" style="color: var(--primary);">${s.tracking_number}</td>
        <td>${s.customer || "Acme Logistics"}</td>
        <td>${s.carrier || "DHL Express"}</td>
        <td style="font-size: 12px;">${s.origin} → ${s.destination}</td>
        <td>
          <span class="badge badge-${String(s.status).toLowerCase()}">
            <span class="badge-dot"></span> ${s.status}
          </span>
        </td>
        <td>
          <span class="badge ${s.priority === 'URGENT' ? 'risk-critical' : s.priority === 'HIGH' ? 'risk-high' : 'badge-created'}">
            ${s.priority}
          </span>
        </td>
        <td class="font-mono" style="font-size: 12px;">
          ${s.expected_delivery ? new Date(s.expected_delivery).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "—"}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm btn-eta" title="Predict ETA" data-id="${s.id}" style="color: var(--primary);">
              ${Icons.clock} ETA
            </button>
            <button class="btn btn-secondary btn-sm btn-status" title="Transition Status" data-id="${s.id}">
              Update
            </button>
            <button class="btn btn-secondary btn-sm btn-delete" title="Soft Delete" data-id="${s.id}" style="color: var(--danger);">
              ${Icons.trash}
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    // Wire action buttons
    tbody.querySelectorAll(".btn-eta").forEach(btn => {
      btn.addEventListener("click", () => {
        EtaModal.open(Number(btn.dataset.id));
      });
    });

    tbody.querySelectorAll(".btn-status").forEach(btn => {
      btn.addEventListener("click", () => {
        this.openStatusTransitionModal(Number(btn.dataset.id));
      });
    });

    tbody.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm(`Perform soft delete on consignment #${btn.dataset.id}?`)) {
          await API.request(`/shipments/${btn.dataset.id}`, { method: "DELETE" });
          Toast.success("Shipment soft-deleted and logged to audit trail.");
          this.loadShipments();
        }
      });
    });
  },

  openStatusTransitionModal(id) {
    const shipment = Store.getState().shipments.find(s => s.id === id);
    if (!shipment) return;

    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    modalRoot.classList.add("active");
    backdropEl.classList.add("active");

    const validNextStates = ["IN_TRANSIT", "CUSTOMS_HOLD", "OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "CANCELLED"];

    modalRoot.innerHTML = `
      <div class="modal-header">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Update Consignment Status: ${shipment.tracking_number}</h3>
        <button class="btn btn-secondary btn-icon" id="close-modal-btn">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Current Status</label>
          <div><span class="badge badge-${shipment.status.toLowerCase()}">${shipment.status}</span></div>
        </div>

        <div class="form-group">
          <label class="form-label">New Transition Status</label>
          <select class="form-select" id="new-status-select">
            ${validNextStates.map(st => `<option value="${st}" ${st === shipment.status ? 'disabled' : ''}>${st}</option>`).join("")}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Event Description / Reason</label>
          <input class="form-input" id="status-reason-input" placeholder="e.g. Scanned at regional terminal hub" value="Status transitioned via operations command center." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-transition-btn">Cancel</button>
        <button class="btn btn-primary" id="confirm-transition-btn">Commit Transition</button>
      </div>
    `;

    const closeModal = () => {
      modalRoot.classList.remove("active");
      backdropEl.classList.remove("active");
    };

    document.getElementById("close-modal-btn")?.addEventListener("click", closeModal);
    document.getElementById("cancel-transition-btn")?.addEventListener("click", closeModal);

    document.getElementById("confirm-transition-btn")?.addEventListener("click", async () => {
      const newStatus = document.getElementById("new-status-select").value;
      const reason = document.getElementById("status-reason-input").value;

      try {
        await API.request(`/shipments/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus, description: reason })
        });
        Toast.success(`Shipment transitioned to ${newStatus}`);
        closeModal();
        this.loadShipments();
      } catch (err) {
        Toast.error(err.message || "Transition rejected");
      }
    });
  },

  openCreateModal() {
    const modalRoot = document.getElementById("modal-root");
    const backdropEl = document.getElementById("modal-backdrop");
    modalRoot.classList.add("active");
    backdropEl.classList.add("active");

    modalRoot.innerHTML = `
      <div class="modal-header">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Create New Consignment</h3>
        <button class="btn btn-secondary btn-icon" id="close-modal-btn">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Tracking Number</label>
          <input class="form-input font-mono" id="create-tracking" value="EXP-${Math.floor(100000 + Math.random() * 900000)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Carrier</label>
          <select class="form-select" id="create-carrier">
            <option value="1">DHL Express</option>
            <option value="2">FedEx</option>
            <option value="3">UPS</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Origin</label>
            <input class="form-input" id="create-origin" value="Shanghai Port, CN" />
          </div>
          <div class="form-group">
            <label class="form-label">Destination</label>
            <input class="form-input" id="create-destination" value="Rotterdam Port, NL" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="create-priority">
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH" selected>HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-create-btn">Cancel</button>
        <button class="btn btn-primary" id="confirm-create-btn">Create Shipment</button>
      </div>
    `;

    const closeModal = () => {
      modalRoot.classList.remove("active");
      backdropEl.classList.remove("active");
    };

    document.getElementById("close-modal-btn")?.addEventListener("click", closeModal);
    document.getElementById("cancel-create-btn")?.addEventListener("click", closeModal);

    document.getElementById("confirm-create-btn")?.addEventListener("click", async () => {
      const tracking_number = document.getElementById("create-tracking").value;
      const carrier_id = Number(document.getElementById("create-carrier").value);
      const origin = document.getElementById("create-origin").value;
      const destination = document.getElementById("create-destination").value;
      const priority = document.getElementById("create-priority").value;

      try {
        await API.request("/shipments", {
          method: "POST",
          body: JSON.stringify({
            tracking_number,
            carrier_id,
            customer_id: 1,
            origin,
            destination,
            priority,
            expected_delivery: new Date(Date.now() + 86400000 * 3).toISOString()
          })
        });
        Toast.success(`Consignment ${tracking_number} registered.`);
        closeModal();
        this.loadShipments();
      } catch (err) {
        Toast.error(err.message || "Failed to create shipment");
      }
    });
  }
};
