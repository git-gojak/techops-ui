
(function () {
  "use strict";

  const aliases = {
    tahun: "calendar",
    komputer: "monitor",
    merek: "package",
    model: "box",
    serial: "barcode",
    cpu: "cpu",
    core: "layers",
    thread: "network",
    ram: "memory",
    storage: "storage",
    gpu: "monitor",
    os: "window",
    pengguna: "user",
    scan_terakhir: "scan",
    perubahan: "history",
    status: "shield",
    unit: "printer",
    tinta: "droplet",
    ftp: "calendar",
    mp: "clock",
    printer: "printer"
  };

  const colors = {
    calendar: "--blue-light",
    monitor: "--blue-light",
    barcode: "--purple",
    package: "--purple",
    box: "--teal",
    cpu: "--blue-light",
    layers: "--purple",
    network: "--teal",
    memory: "--green",
    storage: "--yellow",
    window: "--blue-light",
    user: "--green",
    scan: "--purple",
    history: "--yellow",
    shield: "--green",
    printer: "--blue-light",
    droplet: "--teal",
    clock: "--yellow"
  };

  function render(key) {
    const icon = aliases[key] || key;
    const validIcon = Object.prototype.hasOwnProperty.call(
      colors,
      icon
    ) ? icon : "monitor";

    const color = colors[validIcon];

    return `
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="color:var(${color})"
        aria-hidden="true"
      >
        <use href="./icons/ui.svg#${validIcon}"></use>
      </svg>
    `;
  }

  window.TechOpsIcons = {
    render
  };
})();
