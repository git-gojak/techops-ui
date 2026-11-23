
/* =========================================================
   GOJAK TECHOPS
   DASHBOARD - BATCH 3
   ========================================================= */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    computers: [],
    printers: [],
    maintenance: [],
    archiveCounts: {
      computers: 0,
      printers: 0
    },
    loading: false
  };

  // =======================================================
  // UTILITAS
  // =======================================================

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function arr(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  }

  function dateOf(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value) ? null : value;
    }

    const s = String(value).trim();
    if (!s) return null;

    let m = s.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (m) {
      return new Date(
        +m[3],
        +m[2] - 1,
        +m[1],
        +(m[4] || 0),
        +(m[5] || 0),
        +(m[6] || 0)
      );
    }

    m = s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (m) {
      return new Date(
        +m[1],
        +m[2] - 1,
        +m[3],
        +(m[4] || 0),
        +(m[5] || 0),
        +(m[6] || 0)
      );
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function yearOf(value) {
    const s = String(value ?? "").trim();
    const m = s.match(/^(19|20)\d{2}$/);

    if (m) return +m[0];

    const d = dateOf(value);
    return d ? d.getFullYear() : null;
  }

  function fmtDate(value) {
    const d = dateOf(value);

    return d
      ? new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).format(d)
      : "Tanggal tidak tersedia";
  }

  function fmtDateTime(value) {
    const d = dateOf(value);

    return d
      ? new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(d)
      : "Waktu tidak tersedia";
  }

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  function maskSerial(value) {
    const s = String(value || "").trim();

    if (!s) return "-";
    if (isAdmin()) return s;

    return s.length <= 4
      ? "*".repeat(s.length)
      : "*".repeat(s.length - 4) + s.slice(-4);
  }

  function maskComputer(value) {
    const s = String(value || "").trim();

    if (!s) return "Komputer";
    if (isAdmin()) return s;

    return s.length <= 4
      ? "*".repeat(s.length)
      : s.slice(0, 2) +
        "*".repeat(s.length - 4) +
        s.slice(-2);
  }

  function typeOf(value) {
    const s = String(value || "").trim().toLowerCase();

    if (["komputer", "computer", "pc"].includes(s)) {
      return "komputer";
    }

    if (s === "printer") return "printer";

    return "";
  }

  function archived(row) {
    return String(row?.status || "")
      .trim()
      .toLowerCase() === "arsip";
  }

  function activityDate(row) {
    return row?.["Waktu Dibuat"] || row?.Tanggal || null;
  }

  function keyOf(type, serial, name) {
    const t = typeOf(type);
    const id = String(serial || name || "")
      .trim()
      .toUpperCase();

    return t && id ? `${t}|${id}` : "";
  }

  // =======================================================
  // STATUS KONEKSI
  // =======================================================

  function setOnline(online) {
    document.querySelectorAll(
      ".system-indicator .status-dot, .system-card .status-dot"
    ).forEach(dot => {
      dot.classList.toggle(
        "dashboard-offline",
        !online
      );
    });

    const label = $(".dashboard-connection-label");

    if (label) {
      label.textContent = online
        ? "Online"
        : "Tidak terhubung";
    }
  }

  // =======================================================
  // TIMEOUT API
  // =======================================================

  function timeout(promise, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(label + " tidak merespons.")
        );
      }, 20000);

      promise.then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  // =======================================================
  // MEMUAT DATA
  // =======================================================

  async function loadData() {
    if (!window.TechOpsAPI) {
      throw new Error("TechOpsAPI belum tersedia.");
    }

    const includeArchived =
      TechOpsAPI.isAuthenticated();

    const result = await Promise.all([
      timeout(
        TechOpsAPI.get(
          "computers.list",
          { includeArchived }
        ),
        "Data komputer"
      ),

      timeout(
        TechOpsAPI.get(
          "printers.list",
          { includeArchived }
        ),
        "Data printer"
      ),

      timeout(
        TechOpsAPI.get("maintenance.list"),
        "Data maintenance"
      ),

      timeout(
        TechOpsAPI.get("inventory.archiveCounts"),
        "Data arsip"
      )
    ]);

    state.computers = arr(result[0]);
    state.printers = arr(result[1]);
    state.maintenance = arr(result[2]);

    state.archiveCounts = {
      computers: Number(result[3]?.computers || 0),
      printers: Number(result[3]?.printers || 0)
    };

    setOnline(true);
  }

  // =======================================================
  // STRUKTUR DASHBOARD
  // =======================================================

  function ensureLayout() {
    const page = $("#page-dashboard");

    if (!page) return;

    const grid = $(".dashboard-grid", page);

    if (grid) {
      grid.innerHTML = `
        <article class="stat-card dash-stat computer">
          <div class="stat-icon blue">▣</div>

          <div class="stat-info">
            <span>Total Komputer</span>
            <strong id="totalComputers">—</strong>

            <small>
              <b id="computerAcquired">—</b> Tahun Ini
              <i>·</i>
              <b id="computerArchived">—</b> Arsip
            </small>
          </div>
        </article>

        <article class="stat-card dash-stat printer">
          <div class="stat-icon teal">▤</div>

          <div class="stat-info">
            <span>Total Printer</span>
            <strong id="totalPrinters">—</strong>

            <small>
              <b id="printerAcquired">—</b> Tahun Ini
              <i>·</i>
              <b id="printerArchived">—</b> Arsip
            </small>
          </div>
        </article>

        <article class="stat-card dash-stat maintenance">
          <div class="stat-icon purple">◷</div>

          <div class="stat-info">
            <span>Total Maintenance</span>
            <strong id="totalMaintenance">—</strong>

            <small>
              <b id="totalCare">—</b> Perawatan
              <i>·</i>
              <b id="totalRepair">—</b> Perbaikan
            </small>
          </div>
        </article>

        <article class="stat-card dash-stat connection">
          <div class="stat-icon green">⌁</div>

          <div class="stat-info">
            <span>Koneksi</span>

            <strong class="dashboard-connection-label">
              Memeriksa...
            </strong>

            <small>Google Apps Script</small>
          </div>
        </article>
      `;
    }

    const lower = $(".dashboard-lower-grid", page);

    if (!lower) return;

    lower.innerHTML = `
      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Monitoring Perangkat per Unit</h3>
            <p>
              Jumlah komputer dan printer pada setiap unit
            </p>
          </div>
        </div>

        <div id="unitMonitoring"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Monitoring Jadwal Maintenance</h3>
            <p>
              Jadwal berdasarkan catatan perawatan
              terbaru setiap perangkat
            </p>
          </div>
        </div>

        <div id="dashboardSchedules"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Aktivitas Maintenance Terbaru</h3>
            <p>
              Lima aktivitas komputer dan printer paling baru
            </p>
          </div>
        </div>

        <div id="latestMaintenance"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Kondisi Perangkat</h3>
            <p>
              Berdasarkan catatan Maintenance terbaru
            </p>
          </div>
        </div>

        <div id="dashboardConditions"></div>
      </article>
    `;
  }

  // =======================================================
  // RINGKASAN PERANGKAT
  // =======================================================

  function renderStats() {
    const computers = state.computers.filter(
      row => !archived(row)
    );

    const printers = state.printers.filter(
      row => !archived(row)
    );

    const maintenance = state.maintenance;
    const year = new Date().getFullYear();

    $("#totalComputers").textContent =
      computers.length;

    $("#totalPrinters").textContent =
      printers.length;

    $("#totalMaintenance").textContent =
      maintenance.length;

    $("#computerAcquired").textContent =
      computers.filter(
        row => yearOf(row.tahun) === year
      ).length;

    $("#printerAcquired").textContent =
      printers.filter(
        row => yearOf(row.ftp) === year
      ).length;

    $("#computerArchived").textContent =
      state.archiveCounts.computers;

    $("#printerArchived").textContent =
      state.archiveCounts.printers;

    $("#totalCare").textContent =
      maintenance.filter(row =>
        String(
          row.jenis_kegiatan || row.kegiatan || ""
        ).trim().toLowerCase() === "perawatan"
      ).length;

    $("#totalRepair").textContent =
      maintenance.filter(row =>
        String(
          row.jenis_kegiatan || row.kegiatan || ""
        ).trim().toLowerCase() === "perbaikan"
      ).length;

    setOnline(true);
  }

  // =======================================================
  // MONITORING UNIT
  // =======================================================

  function renderUnits() {
    const map = new Map();

    function add(raw, type) {
      const value = String(raw || "").trim();

      if (!value) return;

      const label = (
        type === "computers" && value.includes("-")
          ? value.split("-")[0]
          : value
      ).trim().toLocaleUpperCase("id-ID");

      if (!map.has(label)) {
        map.set(label, {
          label,
          computers: 0,
          printers: 0
        });
      }

      map.get(label)[type]++;
    }

    state.computers
      .filter(row => !archived(row))
      .forEach(row => {
        add(row.pengguna, "computers");
      });

    state.printers
      .filter(row => !archived(row))
      .forEach(row => {
        add(row.unit, "printers");
      });

    const rows = [...map.values()].sort(
      (a, b) => a.label.localeCompare(b.label, "id")
    );

    $("#unitMonitoring").innerHTML = rows.length
      ? `
        <div class="dashboard-unit-grid">
          ${rows.map(unit => `
            <div class="dashboard-unit-card">
              <strong>${esc(unit.label)}</strong>

              <div class="dashboard-unit-counts">
                <span class="unit-computer">
                  ▣ <b>${unit.computers}</b>
                </span>

                <span class="unit-printer">
                  ▤ <b>${unit.printers}</b>
                </span>
              </div>
            </div>
          `).join("")}
        </div>
      `
      : `
        <div class="dashboard-empty">
          Belum ada data unit.
        </div>
      `;
  }

  // =======================================================
  // DATA MODEL PERANGKAT
  // =======================================================

  function inventoryModels() {
    const map = new Map();

    const devices = [
      ...state.computers.map(row => ({
        type: "komputer",
        serial: row.serial,
        name: row.komputer,
        model: row.model || row.Model
      })),

      ...state.printers.map(row => ({
        type: "printer",
        serial: row.serial,
        name: row.unit,
        model: row.model || row.Model
      }))
    ];

    devices.forEach(device => {
      const key = keyOf(
        device.type,
        device.serial,
        device.name
      );

      if (key && device.model) {
        map.set(key, device.model);
      }
    });

    return map;
  }

  // =======================================================
  // AKTIVITAS MAINTENANCE TERBARU
  // =======================================================

  function renderActivities(models) {
    const rows = state.maintenance
      .map(row => ({
        row,
        date: dateOf(activityDate(row))
      }))
      .sort((a, b) =>
        (b.date?.getTime() || 0) -
        (a.date?.getTime() || 0)
      )
      .slice(0, 5);

    $("#latestMaintenance").innerHTML = rows.length
      ? `
        <div class="dashboard-activity-list">

          ${rows.map(({ row, date }) => {
            const type = typeOf(row.jenis_aset);

            const name = type === "komputer"
              ? maskComputer(row.nama_aset)
              : (row.nama_aset || "Printer");

            const model =
              row.model ||
              row.Model ||
              models.get(
                keyOf(type, row.serial, row.nama_aset)
              ) ||
              "Model tidak tersedia";

            const activity =
              row.jenis_kegiatan ||
              row.kegiatan ||
              "Maintenance";

            return `
              <div class="dashboard-activity-item">

                <span class="dashboard-activity-icon ${type}">
                  ${type === "printer" ? "▤" : "▣"}
                </span>

                <div class="dashboard-activity-info">

                  <strong>${esc(name)}</strong>

                  <span>
                    ${esc(model)}
                    ·
                    ${esc(maskSerial(row.serial))}
                  </span>

                  <small>
                    ${esc(activity)}
                    ·
                    ${esc(
                      row.kondisi ||
                      "Kondisi belum diisi"
                    )}
                  </small>

                  <time>
                    ${esc(fmtDateTime(date))}
                  </time>

                </div>
              </div>
            `;
          }).join("")}

        </div>
      `
      : `
        <div class="dashboard-empty">
          Belum ada aktivitas Maintenance.
        </div>
      `;
  }

  // =======================================================
  // MAINTENANCE TERBARU PER PERANGKAT
  // =======================================================

  function latestMaintenanceMap(filter) {
    const map = new Map();

    state.maintenance
      .map(row => ({
        row,
        date: dateOf(activityDate(row))
      }))
      .filter(item =>
        item.date &&
        (!filter || filter(item.row))
      )
      .sort((a, b) => b.date - a.date)
      .forEach(({ row }) => {
        const key = keyOf(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (key && !map.has(key)) {
          map.set(key, row);
        }
      });

    return map;
  }

  // =======================================================
  // MONITORING JADWAL MAINTENANCE
  // =======================================================

  function renderSchedules(models) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    const latestCare = latestMaintenanceMap(row =>
      String(
        row.jenis_kegiatan || row.kegiatan || ""
      ).trim().toLowerCase() === "perawatan"
    );

    const schedules = [...latestCare.values()]
      .map(row => ({
        row,
        date: dateOf(row.jadwal)
      }))
      .filter(item => item.date)
      .sort((a, b) => a.date - b.date);

    const late = schedules.filter(
      item => item.date < today
    );

    const soon = schedules.filter(
      item =>
        item.date >= today &&
        item.date <= limit
    );

    const later = schedules.filter(
      item => item.date > limit
    );

    const list = schedules
      .slice(0, 8)
      .map(({ row, date }) => {
        const type = typeOf(row.jenis_aset);

        const name = type === "komputer"
          ? maskComputer(row.nama_aset)
          : (row.nama_aset || "Printer");

        const model =
          row.model ||
          row.Model ||
          models.get(
            keyOf(type, row.serial, row.nama_aset)
          ) ||
          "Model tidak tersedia";

        return `
          <div class="dashboard-schedule-item">

            <div>
              <strong>${esc(name)}</strong>

              <small>
                ${esc(type || "Perangkat")}
                ·
                ${esc(model)}
              </small>
            </div>

            <time>${esc(fmtDate(date))}</time>

          </div>
        `;
      })
      .join("");

    $("#dashboardSchedules").innerHTML = `
      <div class="dashboard-schedule-summary">

        <div class="schedule-overdue">
          <strong>${late.length}</strong>
          <span>Terlambat</span>
        </div>

        <div class="schedule-upcoming">
          <strong>${soon.length}</strong>
          <span>Segera · 30 hari</span>
        </div>

        <div class="schedule-future">
          <strong>${later.length}</strong>
          <span>Terjadwal</span>
        </div>

      </div>

      ${
        list
          ? `
            <div class="dashboard-schedule-list">
              ${list}
            </div>
          `
          : `
            <div class="dashboard-empty">
              Belum ada jadwal perawatan.
            </div>
          `
      }

      ${
        schedules.length > 8
          ? `
            <small class="dashboard-more">
              Menampilkan 8 dari ${schedules.length} jadwal.
            </small>
          `
          : ""
      }
    `;
  }

  // =======================================================
  // KONDISI PERANGKAT
  // TABEL KOMPUTER DAN PRINTER
  // =======================================================

  function renderConditions() {
    const latest = latestMaintenanceMap();

    const groups = {
      komputer: {
        baik: 0,
        attention: 0,
        bad: 0,
        unknown: 0
      },

      printer: {
        baik: 0,
        attention: 0,
        bad: 0,
        unknown: 0
      }
    };

    const devices = [
      ...state.computers
        .filter(row => !archived(row))
        .map(row => ({
          type: "komputer",
          serial: row.serial,
          name: row.komputer
        })),

      ...state.printers
        .filter(row => !archived(row))
        .map(row => ({
          type: "printer",
          serial: row.serial,
          name: row.unit
        }))
    ];

    devices.forEach(device => {
      const key = keyOf(
        device.type,
        device.serial,
        device.name
      );

      const condition = String(
        latest.get(key)?.kondisi || ""
      ).trim().toLowerCase();

      let category = "unknown";

      if (condition === "baik") {
        category = "baik";
      } else if (condition === "perlu perhatian") {
        category = "attention";
      } else if (condition === "rusak") {
        category = "bad";
      }

      groups[device.type][category]++;
    });

    const computerArchive =
      Number(state.archiveCounts.computers || 0);

    const printerArchive =
      Number(state.archiveCounts.printers || 0);

    // Arsip tetap dihitung dalam kategori Rusak,
    // mengikuti perhitungan dashboard lama.

    groups.komputer.bad += computerArchive;
    groups.printer.bad += printerArchive;

    const rows = [
      {
        key: "baik",
        label: "Baik"
      },
      {
        key: "attention",
        label: "Perlu Perhatian"
      },
      {
        key: "bad",
        label: "Rusak"
      },
      {
        key: "unknown",
        label: "Belum Ada Data Kondisi"
      }
    ];

    const komputerAktif = state.computers.filter(
      row => !archived(row)
    ).length;

    const printerAktif = state.printers.filter(
      row => !archived(row)
    ).length;

    $("#dashboardConditions").innerHTML = `
      <div class="dashboard-condition-table">

        <div class="condition-table-header">
          <span>Kondisi</span>
          <strong>Komputer</strong>
          <strong>Printer</strong>
        </div>

        ${rows.map(item => `
          <div class="condition-table-row">

            <span class="condition-name">
              <i class="condition-indicator ${item.key}"></i>
              ${item.label}
            </span>

            <strong>
              ${groups.komputer[item.key]}
            </strong>

            <strong>
              ${groups.printer[item.key]}
            </strong>

          </div>
        `).join("")}

      </div>

      <div class="dashboard-condition-footer">

        <span>
          Komputer:
          ${komputerAktif} aktif
          ·
          ${computerArchive} arsip
        </span>

        <span>
          Printer:
          ${printerAktif} aktif
          ·
          ${printerArchive} arsip
        </span>

      </div>
    `;
  }

  // =======================================================
  // PESAN ERROR
  // =======================================================

  function renderError(error) {
    const message = esc(
      error?.message ||
      "Terjadi kesalahan saat mengambil data."
    );

    [
      "#unitMonitoring",
      "#dashboardSchedules",
      "#latestMaintenance",
      "#dashboardConditions"
    ].forEach(selector => {
      const element = $(selector);

      if (element) {
        element.innerHTML = `
          <div class="dashboard-error">
            Data belum dapat dimuat.

            <small>${message}</small>
          </div>
        `;
      }
    });

    setOnline(false);
  }

  // =======================================================
  // RENDER DASHBOARD
  // =======================================================

  function render() {
    ensureLayout();

    const models = inventoryModels();

    renderStats();
    renderUnits();
    renderActivities(models);
    renderSchedules(models);
    renderConditions();
  }

  // =======================================================
  // REFRESH DATA OTOMATIS
  // =======================================================

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    try {
      await loadData();
      render();

    } catch (error) {
      console.error(
        "Dashboard gagal dimuat:",
        error
      );

      renderError(error);

    } finally {
      state.loading = false;
    }
  }

  // =======================================================
  // INISIALISASI
  // =======================================================

  function init() {
    ensureLayout();

    // Muat ulang ketika status Admin berubah.
    document.addEventListener(
      "techops:authchange",
      refresh
    );

    // Pemuatan awal Dashboard.
    refresh();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

  // =======================================================
  // PUBLIC DASHBOARD API
  // =======================================================

  window.DashboardPage = {
    refresh,
    render,
    getState: () => state
  };

})();
