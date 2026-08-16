/**
 * Notification Preferences & Webhook Management View
 */

const PreferencesView = {
  async render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Notification & Webhook Dispatch Hub</h1>
          <p style="font-size: 13px; color: var(--text-tertiary); margin-top: 2px;">Configure channels, register webhook endpoints, generate HMAC secrets, and inspect delivery logs.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="reset-preferences-btn">Reset Defaults</button>
          <button class="btn btn-primary btn-sm" id="save-preferences-btn">Save Changes</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px;">
        <!-- Channels & Subscriptions Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${Icons.bell} Delivery Channels</div>
              <div class="card-description">Active dispatch transport layers</div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-toggle-switch">
              <div>
                <div style="font-weight: 600; color: var(--text-primary);">Email Notifications</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Send HTML tracking digests via Nodemailer</div>
              </div>
              <input type="checkbox" id="pref-email-toggle" class="toggle-switch-input" />
            </div>

            <div class="form-toggle-switch">
              <div>
                <div style="font-weight: 600; color: var(--text-primary);">In-App Notification Feed</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Live bell drawer updates & unread badges</div>
              </div>
              <input type="checkbox" id="pref-inapp-toggle" class="toggle-switch-input" checked />
            </div>

            <div class="form-toggle-switch">
              <div>
                <div style="font-weight: 600; color: var(--text-primary);">Webhook Dispatcher</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Real-time JSON POST events with 3-attempt retry</div>
              </div>
              <input type="checkbox" id="pref-webhook-toggle" class="toggle-switch-input" />
            </div>
          </div>

          <div style="margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
            <div class="card-title" style="font-size: 13px; margin-bottom: 12px;">Subscribed Milestone Triggers</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <input type="checkbox" id="sub-in-transit" checked /> Notify on In-Transit Departure
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <input type="checkbox" id="sub-customs-hold" checked /> Notify on Customs Hold Inspection
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <input type="checkbox" id="sub-delayed" checked /> Notify on Automated Delay Detection
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <input type="checkbox" id="sub-delivered" checked /> Notify on Consignment Delivery
              </label>
            </div>
          </div>
        </div>

        <!-- Webhook Integration & Secret Configuration Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${Icons.webhook} Webhook Endpoint Configuration</div>
              <div class="card-description">Payload signatures with X-Hub-Signature HMAC-SHA256</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Endpoint URL (HTTPS)</label>
            <input class="form-input font-mono" id="webhook-url-input" placeholder="https://api.yourdomain.com/webhooks/shipments" />
          </div>

          <div class="form-group">
            <label class="form-label">HMAC Signing Secret</label>
            <div class="webhook-secret-row">
              <input class="secret-key-display" id="webhook-secret-input" placeholder="whsec_..." readonly />
              <button class="btn btn-secondary btn-sm" id="generate-secret-btn">Generate</button>
            </div>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">Signatures are sent in header: <code class="font-mono" style="color: var(--primary);">X-Hub-Signature: sha256={hash}</code></div>
          </div>

          <div class="webhook-test-box" style="margin-top: 8px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary); margin-bottom: 6px;">Sample Dispatch Payload</div>
            <pre style="color: var(--text-secondary); overflow-x: auto; line-height: 1.4;">{
  "event": "notification.created",
  "timestamp": "2026-08-15T22:50:00Z",
  "data": {
    "shipment_id": 102,
    "tracking_number": "FDX-441092",
    "type": "CUSTOMS_HOLD",
    "priority": "URGENT"
  }
}</pre>
          </div>
        </div>
      </div>

      <!-- Webhook Delivery Log Section -->
      <div class="card" style="margin-top: 20px; padding: 0; overflow: hidden;">
        <div class="card-header" style="padding: 16px 20px 8px;">
          <div>
            <div class="card-title">${Icons.events} Webhook Delivery Logs</div>
            <div class="card-description">Audit attempts, exponential backoff retries, and status codes</div>
          </div>
        </div>
        <div class="table-wrapper" style="border: none;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Target Webhook URL</th>
                <th>Attempt</th>
                <th>Status</th>
                <th>HTTP Code</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-mono" style="font-size: 11px;">2026-08-15 22:45:12</td>
                <td class="font-mono" style="color: var(--text-primary);">https://api.acmelogistics.example/webhooks</td>
                <td><span class="badge badge-delivered">1 of 3</span></td>
                <td><span class="badge badge-delivered">SUCCESS</span></td>
                <td class="font-mono" style="color: var(--success); font-weight: 700;">200 OK</td>
                <td class="font-mono">142 ms</td>
              </tr>
              <tr>
                <td class="font-mono" style="font-size: 11px;">2026-08-15 21:12:04</td>
                <td class="font-mono" style="color: var(--text-primary);">https://api.acmelogistics.example/webhooks</td>
                <td><span class="badge badge-delayed">2 of 3 (Retry)</span></td>
                <td><span class="badge badge-delivered">SUCCESS</span></td>
                <td class="font-mono" style="color: var(--success); font-weight: 700;">200 OK</td>
                <td class="font-mono">1,120 ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadPreferences();

    // Wire listeners
    document.getElementById("generate-secret-btn")?.addEventListener("click", () => {
      const chars = "abcdef0123456789";
      let key = "whsec_";
      for (let i = 0; i < 24; i++) key += chars[Math.floor(Math.random() * chars.length)];
      document.getElementById("webhook-secret-input").value = key;
      Toast.info("New HMAC secret generated. Remember to save changes.");
    });

    document.getElementById("save-preferences-btn")?.addEventListener("click", async () => {
      const email_enabled = document.getElementById("pref-email-toggle").checked;
      const in_app_enabled = document.getElementById("pref-inapp-toggle").checked;
      const webhook_enabled = document.getElementById("pref-webhook-toggle").checked;
      const webhook_url = document.getElementById("webhook-url-input").value;
      const webhook_secret = document.getElementById("webhook-secret-input").value;

      try {
        await API.request("/notifications/preferences", {
          method: "PUT",
          body: JSON.stringify({
            email_enabled,
            in_app_enabled,
            webhook_enabled,
            webhook_url: webhook_url || null,
            webhook_secret: webhook_secret || null
          })
        });
        Toast.success("Notification preferences & webhook config saved.");
      } catch (err) {
        Toast.error("Failed to update preferences: " + err.message);
      }
    });

    document.getElementById("reset-preferences-btn")?.addEventListener("click", async () => {
      if (confirm("Reset notification preferences to factory defaults?")) {
        await API.request("/notifications/preferences/reset", { method: "PUT" });
        Toast.info("Notification preferences reset.");
        this.loadPreferences();
      }
    });
  },

  async loadPreferences() {
    try {
      const res = await API.request("/notifications/preferences");
      const p = res?.data || {};

      document.getElementById("pref-email-toggle").checked = Boolean(p.email_enabled);
      document.getElementById("pref-inapp-toggle").checked = Boolean(p.in_app_enabled);
      document.getElementById("pref-webhook-toggle").checked = Boolean(p.webhook_enabled);
      document.getElementById("webhook-url-input").value = p.webhook_url || "";
      document.getElementById("webhook-secret-input").value = p.webhook_secret || "";
    } catch (err) {
      console.error("Preferences load error:", err);
    }
  }
};
