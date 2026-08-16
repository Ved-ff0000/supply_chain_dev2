/**
 * Dashboard & Extended Analytics View
 */

const DashboardView = {
  interval: "day",
  range: "30d",

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Logistics Analytics & Telemetry</h1>
          <p style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">Real-time aggregation of shipments, carrier transit performance, and delay risks.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <select class="form-select" id="analytics-range-select" style="font-size: 12px; padding: 6px 10px;">
            <option value="7d" ${this.range === "7d" ? "selected" : ""}>Past 7 Days</option>
            <option value="30d" ${this.range === "30d" ? "selected" : ""}>Past 30 Days</option>
            <option value="90d" ${this.range === "90d" ? "selected" : ""}>Past 90 Days</option>
            <option value="1y" ${this.range === "1y" ? "selected" : ""}>Past 1 Year</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="refresh-dashboard-btn">${Icons.refresh} Refresh</button>
        </div>
      </div>

      <!-- High-Level Metric Tiles -->
      <div class="metrics-summary-grid" id="metrics-tiles">
        <div class="metric-card"><div class="metric-header">Loading metrics...</div></div>
      </div>

      <!-- Time Series & Carrier Matrix Row -->
      <div class="analytics-grid-row">
        <!-- Deliveries Over Time SVG Chart -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${Icons.trendUp} Deliveries Over Time</div>
              <div class="card-description">Aggregated via PostgreSQL date_trunc()</div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-secondary btn-sm ${this.interval === 'day' ? 'active' : ''}" id="interval-day-btn">Day</button>
              <button class="btn btn-secondary btn-sm ${this.interval === 'week' ? 'active' : ''}" id="interval-week-btn">Week</button>
              <button class="btn btn-secondary btn-sm ${this.interval === 'month' ? 'active' : ''}" id="interval-month-btn">Month</button>
            </div>
          </div>
          <div class="chart-container" id="deliveries-chart-container">
            <svg class="chart-svg" id="deliveries-svg"></svg>
          </div>
        </div>

        <!-- Carrier On-Time Performance -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${Icons.truck} Carrier On-Time Rate</div>
              <div class="card-description">Delivered vs expected window</div>
            </div>
          </div>
          <div class="matrix-list" id="carrier-ontime-list">
            <div style="color: var(--text-tertiary); font-size: 12px;">Loading carrier matrix...</div>
          </div>
        </div>
      </div>

      <!-- Avg Transit Time & Customs Hold Frequency Row -->
      <div class="analytics-grid-row">
        <!-- Average Transit Time by Carrier -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${Icons.clock} Average Transit Duration</div>
              <div class="card-description">Computed from shipment_events & delivery timestamps</div>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="data-table" id="avg-transit-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Delivered</th>
                  <th>Avg Transit (Days)</th>
                  <th>Avg Hours</th>
                  <th>Min - Max Range</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" style="text-align: center; color: var(--text-tertiary);">Loading transit data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Customs Hold Frequency -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title" style="color: #ec4899;">${Icons.alertTriangle} Customs Hold Frequency</div>
              <div class="card-description">Risk index by origin/destination route</div>
            </div>
          </div>
          <div class="matrix-list" id="customs-hold-list">
            <div style="color: var(--text-tertiary); font-size: 12px;">Loading customs risk...</div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    document.getElementById("analytics-range-select")?.addEventListener("change", (e) => {
      this.range = e.target.value;
      this.loadData();
    });

    document.getElementById("refresh-dashboard-btn")?.addEventListener("click", () => {
      Toast.info("Refreshing telemetry metrics...");
      this.loadData();
    });

    ["day", "week", "month"].forEach(int => {
      document.getElementById(`interval-${int}-btn`)?.addEventListener("click", () => {
        this.interval = int;
        this.render(container);
      });
    });

    await this.loadData();
  },

  async loadData() {
    try {
      const [summaryRes, timeSeriesRes, transitRes, onTimeRes, customsRes] = await Promise.all([
        API.request("/dashboard/summary"),
        API.request(`/dashboard/deliveries-over-time?interval=${this.interval}&range=${this.range}`),
        API.request("/dashboard/avg-transit-time"),
        API.request("/dashboard/on-time-rate"),
        API.request("/dashboard/customs-hold-frequency")
      ]);

      if (summaryRes?.data) this.renderSummaryTiles(summaryRes.data);
      if (timeSeriesRes?.data) this.renderTimeSeriesChart(timeSeriesRes.data);
      if (onTimeRes?.data) this.renderOnTimeMatrix(onTimeRes.data);
      if (transitRes?.data) this.renderTransitTable(transitRes.data);
      if (customsRes?.data) this.renderCustomsRisk(customsRes.data);
    } catch (err) {
      console.error("Dashboard render error:", err);
    }
  },

  renderSummaryTiles(d) {
    const el = document.getElementById("metrics-tiles");
    if (!el) return;

    el.innerHTML = `
      <div class="metric-card">
        <div class="metric-header">Active Shipments <span>${Icons.shipment}</span></div>
        <div class="metric-value-row">
          <span class="metric-main-num">${d.total_shipments || 0}</span>
          <span class="badge badge-in-transit">${d.in_transit || 0} In Transit</span>
        </div>
        <div class="metric-subtext">Across all connected carriers</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">Overdue / Delayed <span>${Icons.alertTriangle}</span></div>
        <div class="metric-value-row">
          <span class="metric-main-num" style="color: var(--warning);">${d.delayed || 0}</span>
          <span class="badge badge-delayed">Delay Detection</span>
        </div>
        <div class="metric-subtext">Auto-flagged by cron engine</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">Customs Holds <span>${Icons.alertTriangle}</span></div>
        <div class="metric-value-row">
          <span class="metric-main-num" style="color: #ec4899;">${d.customs_hold || 0}</span>
          <span class="badge badge-customs-hold">Inspection</span>
        </div>
        <div class="metric-subtext">Awaiting border clearance</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">Delivered Total <span>${Icons.check}</span></div>
        <div class="metric-value-row">
          <span class="metric-main-num" style="color: var(--success);">${d.delivered || 0}</span>
          <span class="badge badge-delivered">Completed</span>
        </div>
        <div class="metric-subtext">Successfully dispatched & verified</div>
      </div>
    `;
  },

  renderTimeSeriesChart(data) {
    const svg = document.getElementById("deliveries-svg");
    if (!svg || !data.length) return;

    const width = svg.clientWidth || 600;
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };

    const maxCount = Math.max(...data.map(d => d.delivery_count), 5);
    const barWidth = Math.max(12, (width - padding.left - padding.right) / data.length - 10);

    let gridLines = "";
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + ((height - padding.top - padding.bottom) / 4) * i;
      const val = Math.round(maxCount - (maxCount / 4) * i);
      gridLines += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />
        <text x="${padding.left - 8}" y="${y + 4}" class="chart-axis-text" text-anchor="end">${val}</text>
      `;
    }

    let bars = "";
    data.forEach((d, idx) => {
      const x = padding.left + idx * ((width - padding.left - padding.right) / data.length) + 6;
      const barHeight = (d.delivery_count / maxCount) * (height - padding.top - padding.bottom);
      const y = height - padding.bottom - barHeight;

      const dateStr = new Date(d.time_bucket).toLocaleDateString([], { month: 'numeric', day: 'numeric' });

      bars += `
        <g class="chart-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" class="chart-bar">
            <title>${dateStr}: ${d.delivery_count} deliveries (${d.on_time_count} on-time, ${d.late_count} late)</title>
          </rect>
          <text x="${x + barWidth / 2}" y="${height - 12}" class="chart-axis-text" text-anchor="middle">${dateStr}</text>
        </g>
      `;
    });

    svg.innerHTML = `
      ${gridLines}
      ${bars}
    `;
  },

  renderOnTimeMatrix(d) {
    const el = document.getElementById("carrier-ontime-list");
    if (!el) return;

    const summary = d.summary || {};
    const carriers = d.carriers || [];

    el.innerHTML = `
      <div style="margin-bottom: 12px; padding: 10px; background-color: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span>Fleet Overall Rate</span>
          <strong style="color: var(--success); font-family: var(--font-mono);">${summary.overall_on_time_rate_pct || 90}%</strong>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill success" style="width: ${summary.overall_on_time_rate_pct || 90}%;"></div>
        </div>
      </div>

      ${carriers.map(c => `
        <div class="matrix-item">
          <div>
            <div class="matrix-item-title">${c.carrier_name || c.carrier}</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">${c.on_time_count || 0} on-time of ${c.total_evaluated_shipments || 0}</div>
          </div>
          <div style="text-align: right;">
            <div class="matrix-item-stat" style="color: ${c.on_time_rate_pct >= 90 ? 'var(--success)' : 'var(--warning)'};">${c.on_time_rate_pct || 0}%</div>
            <div class="progress-bar-container" style="width: 70px;">
              <div class="progress-bar-fill ${c.on_time_rate_pct >= 90 ? 'success' : 'warning'}" style="width: ${c.on_time_rate_pct || 0}%;"></div>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  },

  renderTransitTable(data) {
    const tbody = document.querySelector("#avg-transit-table tbody");
    if (!tbody) return;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-tertiary);">No delivered transit history yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(c => `
      <tr>
        <td class="td-strong">${c.carrier_name || c.carrier}</td>
        <td class="font-mono">${c.delivered_shipments || 0}</td>
        <td class="font-mono" style="color: var(--primary); font-weight: 700;">${c.avg_transit_days || 0} d</td>
        <td class="font-mono">${c.avg_transit_hours || 0} h</td>
        <td class="font-mono" style="color: var(--text-tertiary); font-size: 11px;">${c.min_transit_hours || 0}h - ${c.max_transit_hours || 0}h</td>
      </tr>
    `).join("");
  },

  renderCustomsRisk(d) {
    const el = document.getElementById("customs-hold-list");
    if (!el) return;

    const routes = d.by_route || [];
    el.innerHTML = routes.map(r => `
      <div class="matrix-item">
        <div>
          <div class="matrix-item-title" style="font-size: 12px;">${r.origin} → ${r.destination}</div>
          <div style="font-size: 11px; color: var(--text-tertiary);">${r.customs_hold_count} holds / ${r.total_shipments} total runs</div>
        </div>
        <div style="text-align: right;">
          <span class="badge ${r.hold_rate_pct > 10 ? 'risk-high' : 'risk-low'}">${r.hold_rate_pct}% Risk</span>
        </div>
      </div>
    `).join("");
  }
};
