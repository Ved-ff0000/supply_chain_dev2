/**
 * Reactive State Management Store
 */

const Store = {
  state: {
    user: {
      id: 1,
      name: "Operations Dispatcher",
      email: "ops@supplychainhub.example",
      role: "OPERATIONS", // OPERATIONS | ADMIN | CUSTOMER
      customer_id: null
    },
    currentView: "dashboard",
    shipments: [],
    events: [],
    notifications: [],
    unreadCount: 0,
    metrics: null,
    auditLogs: [],
    preferences: null,
    usersList: [],
    isLoading: false,
    activeEtaShipmentId: null,
    activeDiffAuditId: null,
    isNotificationDrawerOpen: false,
    searchQuery: ""
  },

  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach((listener) => listener(this.state));
  },

  getState() {
    return this.state;
  },

  setRole(role) {
    const roles = {
      OPERATIONS: {
        id: 2,
        name: "Elena Rostova (Ops Lead)",
        email: "ops@supplychainhub.example",
        role: "OPERATIONS",
        customer_id: null
      },
      ADMIN: {
        id: 1,
        name: "Marcus Vance (System Admin)",
        email: "admin@supplychainhub.example",
        role: "ADMIN",
        customer_id: null
      },
      CUSTOMER: {
        id: 3,
        name: "Acme Logistics Buyer",
        email: "buyer@acme.example",
        role: "CUSTOMER",
        customer_id: 1
      }
    };

    const user = roles[role] || roles.OPERATIONS;
    this.setState({ user });
  },

  setView(viewName) {
    this.setState({ currentView: viewName });
  }
};
