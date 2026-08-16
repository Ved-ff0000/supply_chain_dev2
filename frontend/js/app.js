/* App bootstrap and view router */

const App = {
  views: {
    dashboard: DashboardView,
    shipments: ShipmentsView,
    events: EventsView,
    preferences: PreferencesView,
    audit: AuditLogView
  },

  async init() {
    this.viewRoot = document.getElementById("view-root");
    this.mainContainer = document.getElementById("main-container");

    // wire nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const view = item.dataset.view;
        Store.setView(view);
        this.routeTo(view);
      });
    });

    // role select
    document.getElementById('role-select')?.addEventListener('change', (e) => {
      Store.setRole(e.target.value);
      Toast.info(`Role set to ${e.target.value}`);
      // refresh current view with new role header/scoped data
      this.routeTo(Store.getState().currentView);
      this.loadNotifications();
    });

    // search
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => {
      Store.setState({ searchQuery: e.target.value });
      // re-render shipments table if on shipments
      if (Store.getState().currentView === 'shipments') {
        ShipmentsView.renderTable(Store.getState().shipments || []);
      }
    });

    document.getElementById('search-clear')?.addEventListener('click', () => {
      searchInput.value = '';
      Store.setState({ searchQuery: '' });
      if (Store.getState().currentView === 'shipments') ShipmentsView.renderTable(Store.getState().shipments || []);
    });

    // notification drawer
    document.getElementById('notification-btn')?.addEventListener('click', () => {
      Store.setState({ isNotificationDrawerOpen: !Store.getState().isNotificationDrawerOpen });
      NotificationDrawer.render();
    });

    document.getElementById('drawer-backdrop')?.addEventListener('click', () => {
      Store.setState({ isNotificationDrawerOpen: false });
      NotificationDrawer.render();
    });

    // modal backdrop click closes modals
    document.getElementById('modal-backdrop')?.addEventListener('click', () => {
      document.getElementById('modal-root').classList.remove('active');
      document.getElementById('modal-backdrop').classList.remove('active');
    });

    // subscribe to store updates
    Store.subscribe((state) => {
      const badge = document.getElementById('notif-badge');
      const unread = state.notifications.filter(n => n.status === 'UNREAD').length;
      badge.textContent = unread > 0 ? String(unread) : '';

      // if drawer is open, re-render it
      if (state.isNotificationDrawerOpen) NotificationDrawer.render();
    });

    // initial data load
    await Promise.all([
      this.loadNotifications(),
      API.request('/shipments').then(r => { Store.setState({ shipments: r.data || [] }); }),
      API.request('/dashboard/summary').then(r => { Store.setState({ metrics: r.data || null }); })
    ]).catch(() => {});

    // initial route
    this.routeTo(Store.getState().currentView || 'dashboard');
  },

  async routeTo(viewName) {
    const view = this.views[viewName];
    if (!view) return;
    this.viewRoot.innerHTML = '';
    // render view and allow it to mount children
    await view.render(this.viewRoot);
  },

  async loadNotifications() {
    try {
      const res = await API.request('/notifications');
      const data = res.data || [];
      Store.setState({ notifications: data, unreadCount: res.unread_count || 0 });
      // ensure drawer UI updated
      NotificationDrawer.render();
    } catch (err) {
      console.warn('Notification load failed', err);
    }
  }
};

// initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
