/**
 * Notification Center Slide-Out Drawer
 */

const NotificationDrawer = {
  render() {
    const state = Store.getState();
    const notifications = state.notifications || [];

    const drawerEl = document.getElementById("notification-drawer");
    const backdropEl = document.getElementById("drawer-backdrop");

    if (!drawerEl) return;

    if (state.isNotificationDrawerOpen) {
      drawerEl.classList.add("active");
      backdropEl.classList.add("active");
    } else {
      drawerEl.classList.remove("active");
      backdropEl.classList.remove("active");
      return;
    }

    const unreadCount = notifications.filter(n => n.status === "UNREAD").length;

    drawerEl.innerHTML = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--primary); display: flex;">${Icons.bell}</span>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Notification Center</h3>
          ${unreadCount > 0 ? `<span class="badge badge-in-transit">${unreadCount} Unread</span>` : ""}
        </div>
        <button class="btn btn-secondary btn-icon" id="close-drawer-btn">${Icons.close}</button>
      </div>

      <div class="drawer-body">
        ${notifications.length === 0 ? `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-tertiary);">
            <p style="font-size: 13px;">No notifications in feed.</p>
          </div>
        ` : notifications.map(item => `
          <div class="notification-item ${item.status === 'UNREAD' ? 'unread' : ''}" data-id="${item.id}">
            <div class="notification-item-header">
              <span class="badge badge-${String(item.type).toLowerCase()}">${item.type}</span>
              <span class="notification-item-time">${new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="notification-item-title">${item.title}</div>
            <div class="notification-item-msg">${item.message}</div>
          </div>
        `).join("")}
      </div>

      <div class="drawer-footer">
        <button class="btn btn-secondary btn-sm" id="mark-all-read-btn">Mark All Read</button>
      </div>
    `;

    document.getElementById("close-drawer-btn")?.addEventListener("click", () => {
      Store.setState({ isNotificationDrawerOpen: false });
    });

    document.getElementById("mark-all-read-btn")?.addEventListener("click", async () => {
      const updated = state.notifications.map(n => ({ ...n, status: "READ" }));
      Store.setState({ notifications: updated, unreadCount: 0 });
      Toast.success("All notifications marked as read.");
    });
  }
};
