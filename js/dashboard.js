/* GoJak TechOps - Dashboard
   Batch 3 | Menggunakan TechOpsAPI yang sudah tersedia.
*/
(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    computers: [],
    printers: [],
    maintenance: [],
    archiveCounts: { computers: 0, printers: 0 },
    lastUpdated: null,
    loading: false,
    loaded: false,
    error: null
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  }

  function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();
    if (!text) return null;

    // Format ISO: 2026-11-23T10:30:00
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(text)) {
      const date = new Date(text.replace(" ", "T"));
      return isNaN(date.getTime()) ? null : date;
    }

    // Format Indonesia: 23-11-2026 10:30:00
    let match = text.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (match) {
      const date = new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0)
      );

      return isNaN(date.getTime()) ? null : date;
    }

    // Format tahun-bulan-tanggal
    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    }

    const fallback = new Date(text);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "Tanggal tidak tersedia";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return "Waktu tidak tersedia";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  // Penyamaran data untuk pengunjung publik.
  function maskValue(value) {
    const text = String(value || "").trim();

    if (!text) return "-";
    if (isAdmin()) return text;

    if (text.length <= 4) {
      return "*".repeat(text.length);
    }

    return "*".repeat(text.length - 4) + text.slice(-4);
  }

  function maskComputerName(value) {
    const text = String(value || "").trim();

    if (!text) return "Komputer";

    if (isAdmin()) return text;

    if (text.length <= 4) {
      return "*".repeat(text.length);
    }

    return text.slice(0, 2) +
      "*".repeat(text.length - 4) +
      text.slice(-2);
  }

  function normalizeAssetType(value) {
    const type = String(value || "").trim().toLowerCase();

    if (["komputer", "computer", "pc"].includes(type)) {
      return "komputer";
    }

    if (type === "printer") return "printer";

    return "";
  }

  function isArchived(row) {
    return String(row?.status || "")
      .trim()
      .toLowerCase() === "arsip";
  }

  function getActivityDate(row) {
    return row?.["Waktu Dibuat"] || row?.Tanggal || null;
  }

  function deviceKey(type, serial, name) {
    const assetType = normalizeAssetType(type);
    const identity = String(serial || name || "")
      .trim()
      .toUpperCase();

    return assetType && identity
      ? `${assetType}|${identity}`
      : "";
  }

  function setConnection(online) {
    document.querySelectorAll(
      ".system-indicator .status-dot, .system-card .status-dot"
    ).forEach(dot => {
      dot.classList.toggle("dashboard-offline", !online);
    });
  }

  function withTimeout(promise, label, milliseconds = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(label + " tidak merespons."));
      }, milliseconds);

      promise.then(
        result => {
          clearTimeout(timer);
          resolve(result);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  async function loadData() {
    if (!window.TechOpsAPI) {
      throw new Error("TechOpsAPI belum tersedia.");
    }

    const includeArchived = TechOpsAPI.isAuthenticated();

    const results = await Promise.all([
      withTimeout(
        TechOpsAPI.get("computers.list", {
          includeArchived
        }),
        "Data komputer"
      ),

      withTimeout(
        TechOpsAPI.get("printers.list", {
          includeArchived
        }),
        "Data printer"
      ),

      withTimeout(
        TechOpsAPI.get("maintenance.list"),
        "Data maintenance"
      ),

      withTimeout(
        TechOpsAPI.get("inventory.archiveCounts"),
        "Data arsip"
      )
    ]);

    state.computers = normalizeArray(results[0]);
    state.printers = normalizeArray(results[1]);
    state.maintenance = normalizeArray(results[2]);

    state.archiveCounts = {
      computers: Number(results[3]?.computers || 0),
      printers: Number(results[3]?.printers || 0)
    };

    state.lastUpdated = new Date();
    state.loaded = true;
    state.error = null;

    setConnection(true);
  }

  function ensureDashboardExtras() {
    const page = $("#page-dashboard");
    const lowerGrid = $(".dashboard-lower-grid", page);

    if (!page || !lowerGrid) return;

    if (!$("#dashboardMeta", page)) {
      lowerGrid.insertAdjacentHTML("beforebegin", `
        <div class="dashboard-meta" id="dashboardMeta">
          <div>
            <span class="dashboard-meta-dot"></span>
            <span id="dashboardUpdateText">
              Menunggu data...
            </span>
          </div>

          <button
            type="button"
            class="dashboard-refresh"
            id="dashboardRefresh">
            <span>↻</span> Perbarui Data
          </button>
        </div>
      `);
    }

    if (!$("#dashboardExtraGrid", page)) {
      lowerGrid.insertAdjacentHTML("afterend", `
        <div class="dashboard-extra-grid" id="dashboardExtraGrid">

          <article class="glass-card dashboard-panel">
            <div class="card-heading">
              <h3>Monitoring Jadwal Maintenance</h3>
              <p>Jadwal perawatan perangkat</p>
            </div>
            <div id="dashboardSchedules"></div>
          </article>

          <article class="glass-card dashboard-panel">
            <div class="card-heading">
              <h3>Kondisi Perangkat</h3>
              <p>Berdasarkan catatan Maintenance terbaru</p>
            </div>
            <div id="dashboardConditions"></div>
          </article>

        </div>
      `);
    }
  }

  function renderStats(computers, printers, maintenance) {
    const activeComputers = computers.filter(row => !isArchived(row));
    const activePrinters = printers.filter(row => !isArchived(row));

    const totalGood = countGoodDevices(
      activeComputers,
      activePrinters,
      maintenance
    );

    $("#totalComputers").textContent = activeComputers.length;
    $("#totalPrinters").textContent = activePrinters.length;
    $("#totalMaintenance").textContent = maintenance.length;
    $("#goodDevices").textContent = totalGood;

    const computerCard = $("#totalComputers")?.closest(".stat-card");
    const printerCard = $("#totalPrinters")?.closest(".stat-card");

    if (computerCard) {
      const note = computerCard.querySelector("small");
      if (note) {
        note.textContent =
          `${state.archiveCounts.computers} perangkat arsip`;
      }
    }

    if (printerCard) {
      const note = printerCard.querySelector("small");
      if (note) {
        note.textContent =
          `${state.archiveCounts.printers} perangkat arsip`;
      }
    }
  }

  function countGoodDevices(computers, printers, maintenance) {
    const latest = new Map();

    maintenance
      .map(row => ({
        row,
        date: parseDate(getActivityDate(row))
      }))
      .filter(item => item.date)
      .sort((a, b) => b.date - a.date)
      .forEach(item => {
        const row = item.row;
        const key = deviceKey(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (key && !latest.has(key)) {
          latest.set(key, row);
        }
      });

    const devices = [
      ...computers.map(row => ({
        type: "komputer",
        serial: row.serial,
        name: row.komputer
      })),
      ...printers.map(row => ({
        type: "printer",
        serial: row.serial,
        name: row.unit
      }))
    ];

    return devices.filter(device => {
      const key = deviceKey(
        device.type,
        device.serial,
        device.name
      );

      const condition = String(
        latest.get(key)?.kondisi || ""
      ).trim().toLowerCase();

      return condition === "baik";
    }).length;
  }

  function renderUnits() {
    const host = $("#unitMonitoring");
    if (!host) return;

    const units = new Map();

    function addUnit(raw, type) {
      const value = String(raw || "").trim();
      if (!value) return;

      // Pengguna komputer memakai format KODE UNIT-NAMA.
      const code = type === "computers" && value.includes("-")
        ? value.split("-")[0].trim()
        : value;

      const label = code.toLocaleUpperCase("id-ID");

      if (!units.has(label)) {
        units.set(label, {
          label,
          computers: 0,
          printers: 0
        });
      }

      units.get(label)[type]++;
    }

    state.computers
      .filter(row => !isArchived(row))
      .forEach(row => addUnit(row.pengguna, "computers"));

    state.printers
      .filter(row => !isArchived(row))
      .forEach(row => addUnit(row.unit, "printers"));

    const rows = [...units.values()].sort(
      (a, b) => a.label.localeCompare(b.label, "id")
    );

    if (!rows.length) {
      host.innerHTML = `
        <div class="dashboard-empty">
          Belum ada data unit.
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="dashboard-unit-grid">
        ${rows.map(unit => `
          <div class="dashboard-unit-card">
            <strong>${escapeHTML(unit.label)}</strong>

            <div class="dashboard-unit-counts">
              <span class="unit-computer">
                <span>▣</span>
                ${unit.computers}
              </span>

              <span class="unit-printer">
                <span>▤</span>
                ${unit.printers}
              </span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderActivities() {
    const host = $("#latestMaintenance");
    if (!host) return;

    const activities = state.maintenance
      .map(row => ({
        ...row,
        _date: parseDate(getActivityDate(row))
      }))
      .sort((a, b) =>
        (b._date?.getTime() || 0) -
        (a._date?.getTime() || 0)
      )
      .slice(0, 5);

    if (!activities.length) {
      host.innerHTML = `
        <div class="dashboard-empty">
          Belum ada aktivitas Maintenance.
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="dashboard-activity-list">
        ${activities.map(row => {
          const type = normalizeAssetType(row.jenis_aset);
          const rawName = row.nama_aset || "Perangkat";

          const name = type === "komputer"
            ? maskComputerName(rawName)
            : rawName;

          const serial = maskValue(row.serial);
          const activity =
            row.jenis_kegiatan || row.kegiatan || "Maintenance";

          return `
            <div class="dashboard-activity-item">
              <div class="dashboard-activity-icon ${type}">
                ${type === "printer" ? "▤" : "▣"}
              </div>

              <div class="dashboard-activity-info">
                <strong>${escapeHTML(name)}</strong>

                <span>
                  ${escapeHTML(activity)}
                  · ${escapeHTML(row.kondisi || "Kondisi belum diisi")}
                </span>

                <small>
                  ${escapeHTML(formatDateTime(getActivityDate(row)))}
                </small>
              </div>

              <span class="dashboard-activity-serial">
                ${escapeHTML(serial)}
              </span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderSchedules() {
    const host = $("#dashboardSchedules");
    if (!host) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next30 = new Date(today);
    next30.setDate(next30.getDate() + 30);

    const latestCare = new Map();

    state.maintenance
      .filter(row =>
        String(row.jenis_kegiatan || row.kegiatan || "")
          .trim()
          .toLowerCase() === "perawatan"
      )
      .map(row => ({
        row,
        created: parseDate(getActivityDate(row))
      }))
      .sort((a, b) =>
        (b.created?.getTime() || 0) -
        (a.created?.getTime() || 0)
      )
      .forEach(item => {
        const row = item.row;
        const key = deviceKey(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (key && !latestCare.has(key)) {
          latestCare.set(key, row);
        }
      });

    const schedules = [...latestCare.values()]
      .map(row => ({
        row,
        date: parseDate(row.jadwal)
      }))
      .filter(item => item.date)
      .sort((a, b) => a.date - b.date);

    const overdue = schedules.filter(item => item.date < today).length;
    const upcoming = schedules.filter(
      item => item.date >= today && item.date <= next30
    ).length;

    const future = schedules.filter(item => item.date > next30).length;

    host.innerHTML = `
      <div class="dashboard-schedule-summary">
        <div class="schedule-overdue">
          <strong>${overdue}</strong>
          <span>Terlambat</span>
        </div>

        <div class="schedule-upcoming">
          <strong>${upcoming}</strong>
          <span>30 Hari</span>
        </div>

        <div class="schedule-future">
          <strong>${future}</strong>
          <span>Terjadwal</span>
        </div>
      </div>

      ${
        schedules.length
          ? `
            <div class="dashboard-schedule-list">
              ${schedules.slice(0, 5).map(item => {
                const row = item.row;
                const type = normalizeAssetType(row.jenis_aset);

                const name = type === "komputer"
                  ? maskComputerName(row.nama_aset)
                  : (row.nama_aset || "Printer");

                return `
                  <div class="dashboard-schedule-item">
                    <div>
                      <strong>${escapeHTML(name)}</strong>
                      <small>${escapeHTML(type || "Perangkat")}</small>
                    </div>
                    <span>${escapeHTML(formatDate(item.date))}</span>
                  </div>
                `;
              }).join("")}
            </div>
          `
          : `
            <div class="dashboard-empty">
              Belum ada jadwal perawatan.
            </div>
          `
      }
    `;
  }

  function renderConditions() {
    const host = $("#dashboardConditions");
    if (!host) return;

    const latest = new Map();

    state.maintenance
      .map(row => ({
        row,
        date: parseDate(getActivityDate(row))
      }))
      .filter(item => item.date)
      .sort((a, b) => b.date - a.date)
      .forEach(item => {
        const row = item.row;
        const key = deviceKey(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (key && !latest.has(key)) {
          latest.set(key, row);
        }
      });

    const counts = {
      baik: 0,
      perhatian: 0,
      rusak: 0,
      unknown: 0
    };

    const devices = [
      ...state.computers
        .filter(row => !isArchived(row))
        .map(row => ({
          type: "komputer",
          serial: row.serial,
          name: row.komputer
        })),
      ...state.printers
        .filter(row => !isArchived(row))
        .map(row => ({
          type: "printer",
          serial: row.serial,
          name: row.unit
        }))
    ];

    devices.forEach(device => {
      const key = deviceKey(
        device.type,
        device.serial,
        device.name
      );

      const condition = String(
        latest.get(key)?.kondisi || ""
      ).trim().toLowerCase();

      if (condition === "baik") {
        counts.baik++;
      } else if (condition === "perlu perhatian") {
        counts.perhatian++;
      } else if (condition === "rusak") {
        counts.rusak++;
      } else {
        counts.unknown++;
      }
    });

    host.innerHTML = `
      <div class="dashboard-condition-list">
        <div>
          <span class="condition-indicator good"></span>
          <span>Baik</span>
          <strong>${counts.baik}</strong>
        </div>

        <div>
          <span class="condition-indicator attention"></span>
          <span>Perlu Perhatian</span>
          <strong>${counts.perhatian}</strong>
        </div>

        <div>
          <span class="condition-indicator bad"></span>
          <span>Rusak</span>
          <strong>${counts.rusak}</strong>
        </div>

        <div>
          <span class="condition-indicator unknown"></span>
          <span>Belum Ada Data Kondisi</span>
          <strong>${counts.unknown}</strong>
        </div>
      </div>

      <p class="dashboard-condition-note">
        Kondisi dihitung dari catatan Maintenance terbaru
        untuk setiap perangkat aktif.
      </p>
    `;
  }

  function renderMeta() {
    const label = $("#dashboardUpdateText");
    if (label) {
      label.textContent = state.lastUpdated
        ? "Data diperbarui " + formatDateTime(state.lastUpdated)
        : "Data belum diperbarui";
    }
  }

  function renderError(error) {
    const message = escapeHTML(
      error?.message || "Terjadi kesalahan saat mengambil data."
    );

    [
      "#unitMonitoring",
      "#latestMaintenance",
      "#dashboardSchedules",
      "#dashboardConditions"
    ].forEach(selector => {
      const host = $(selector);
      if (!host) return;

      host.innerHTML = `
        <div class="dashboard-error">
          <span>Data belum dapat dimuat.</span>
          <small>${message}</small>
        </div>
      `;
    });

    setConnection(false);
  }

  function render() {
    ensureDashboardExtras();

    const computers = state.computers.filter(row => !isArchived(row));
    const printers = state.printers.filter(row => !isArchived(row));

    renderStats(computers, printers, state.maintenance);
    renderUnits();
    renderActivities();
    renderSchedules();
    renderConditions();
    renderMeta();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const button = $("#dashboardRefresh");
    if (button) {
      button.disabled = true;
      button.innerHTML = "<span>↻</span> Memuat...";
    }

    try {
      await loadData();
      render();
    } catch (error) {
      state.error = error;
      renderError(error);
      console.error("Dashboard gagal dimuat:", error);
    } finally {
      state.loading = false;

      const currentButton = $("#dashboardRefresh");
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.innerHTML = "<span>↻</span> Perbarui Data";
      }
    }
  }

  function init() {
    ensureDashboardExtras();

    document.addEventListener("click", event => {
      if (event.target.closest("#dashboardRefresh")) {
        refresh();
      }
    });

    // Saat login/logout, data dimuat ulang sesuai hak akses.
    document.addEventListener("techops:authchange", () => {
      refresh();
    });

    refresh();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.DashboardPage = {
    refresh,
    render,
    getState: () => state
  };
})();
