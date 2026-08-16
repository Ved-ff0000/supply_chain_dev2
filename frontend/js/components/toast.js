/**
 * Non-Intrusive Toast System
 */

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },

  show(message, type = "info", duration = 3500) {
    this.init();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const iconSpan = document.createElement("span");
    iconSpan.style.display = "flex";
    iconSpan.style.alignItems = "center";
    iconSpan.innerHTML = type === "success" ? Icons.check : type === "error" ? Icons.alertTriangle : Icons.clock;

    const textSpan = document.createElement("span");
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    this.container.appendChild(toast);

    // Trigger animation in next frame
    requestAnimationFrame(() => {
      toast.classList.add("active");
    });

    setTimeout(() => {
      toast.classList.remove("active");
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  success(msg) { this.show(msg, "success"); },
  error(msg) { this.show(msg, "error"); },
  info(msg) { this.show(msg, "info"); }
};
