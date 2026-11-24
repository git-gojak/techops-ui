
/* =========================================================
   GOJAK TECHOPS
   DASHBOARD - PUBLIC DATA PROTECTION
   ========================================================= */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    computers: [],
    printers: [],
    maintenance: [],
    archiveCounts: { computers: 0, printers: 0 },
    loading: false
  };

  let schedulePage = 0;

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

  function iconSvg(name) {
    const paths = {
      computer: `
        <rect x="3" y="4" width="18" height="13" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      `,
      printer: `
        <path d="M6 9V3h12v6"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <path d="M6 14h12v7H6z"/>
        <path d="M18 12h.01"/>
      `,
      maintenance: `
        <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-2-2z"/>
      `,
      connection: `
        <circle cx="5" cy="12" r="2"/>
        <circle cx="19" cy="5" r="2"/>
        <circle cx="19" cy="19" r="2"/>
        <path d="m7 11 10-5M7 13l10 5"/>
      `
    };

    return `
      <svg viewBox="0 0 24 24" width="21" height="21"
        fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        ${paths[name] || paths.computer}
      </svg>
    `;
  }

  function arr(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  }

  function dateOf(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value) ? null : value;

    const s = String(value).trim();
    if (!s) return null;

    let m = s.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (m) {
      return new Date(
        +m[3], +m[2] - 1, +m[1],
        +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)
      );
    }

    m = s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (m) {
      return new Date(
        +m[1], +m[2] - 1, +m[3],
        +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)
      );
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function yearOf(value) {
    const s = String(value ?? "").trim();
    const m = s.match(/^(19|20)\d{2}$/);
    if (m) return Number(m[0]);

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

  function typeOf(value) {
    const s = String(value || "").trim().toLowerCase();

    if (["komputer", "computer", "pc"].includes(s)) {
      return "komputer";
    }

    if (s === "printer") return "printer";
    return "";
  }

  function archived(row) {
    return String(row?.status || "").trim().toLowerCase() === "arsip";
  }

  function activityDate(row) {
    return row?.["Waktu Dibuat"] || row?.Tanggal || null;
  }

  function keyOf(type, serial, name) {
    const t = typeOf(type);
    const id = String(serial || name || "").trim().toUpperCase();
    return t && id ? `${t}|${id}` : "";
  }

  function activityType(row) {
    return String(
      row?.jenis_kegiatan || row?.kegiatan || ""
    ).trim().toLowerCase();
  }

  // =======================================================
  // STATUS KONEKSI
  // =======================================================

  function setOnline(online) {
    document.querySelectorAll(
      ".system-indicator .status-dot, .system-card .status-dot"
    ).forEach(dot => {
      dot.classList.toggle("dashboard-offline", !online);
    });

    const label = $(".dashboard-connection-label");

    if (label) {
      label.textContent = online ? "Online" : "Tidak terhubung";
    }
  }

  // =======================================================
  // KONTROL DATA PUBLIK / ADMIN
  // =======================================================

  function isDashboardAdmin() {
    try {
      return Boolean(
        window.TechOpsAPI &&
        typeof TechOpsAPI.isAuthenticated === "function" &&
        TechOpsAPI.isAuthenticated()
      );
    } catch (error) {
      return false;
    }
  }

  // =======================================================
  // TIMEOUT API
  // =======================================================

  function timeout(promise, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(label + " tidak merespons."));
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

    const includeArchived = TechOpsAPI.isAuthenticated();

    const result = await Promise.all([
      timeout(
        TechOpsAPI.get("computers.list", { includeArchived }),
        "Data komputer"
      ),
      timeout(
        TechOpsAPI.get("printers.list", { includeArchived }),
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
          <div class="stat-icon blue">${iconSvg("computer")}</div>
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
          <div class="stat-icon teal">${iconSvg("printer")}</div>
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
          <div class="stat-icon purple">${iconSvg("maintenance")}</div>
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
          <div class="stat-icon green">${iconSvg("connection")}</div>
          <div class="stat-info">
            <span>Koneksi</span>
            <strong class="dashboard-connection-label">Memeriksa...</strong>
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
            <p>Jumlah komputer dan printer pada setiap unit</p>
          </div>
        </div>
        <div id="unitMonitoring"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Monitoring Jadwal Maintenance</h3>
            <p>Jadwal berdasarkan catatan perawatan terbaru setiap perangkat</p>
          </div>
        </div>
        <div id="dashboardSchedules"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Aktivitas Maintenance Terbaru</h3>
            <p>Lima aktivitas komputer dan printer paling baru</p>
          </div>
        </div>
        <div id="latestMaintenance"></div>
      </article>

      <article class="glass-card dash-panel">
        <div class="card-heading">
          <div>
            <h3>Kondisi Perangkat</h3>
            <p>Berdasarkan catatan Maintenance terbaru</p>
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
    const computers = state.computers.filter(row => !archived(row));
    const printers = state.printers.filter(row => !archived(row));
    const maintenance = state.maintenance;
    const year = new Date().getFullYear();

    $("#totalComputers").textContent = computers.length;
    $("#totalPrinters").textContent = printers.length;
    $("#totalMaintenance").textContent = maintenance.length;

    $("#computerAcquired").textContent =
      computers.filter(row => yearOf(row.tahun) === year).length;

    $("#printerAcquired").textContent =
      printers.filter(row => yearOf(row.ftp) === year).length;

    $("#computerArchived").textContent = state.archiveCounts.computers;
    $("#printerArchived").textContent = state.archiveCounts.printers;

    $("#totalCare").textContent =
      maintenance.filter(row => activityType(row) === "perawatan").length;

    $("#totalRepair").textContent =
      maintenance.filter(row => activityType(row) === "perbaikan").length;

    setOnline(true);
  }

  // =======================================================
  // MONITORING UNIT
  // =======================================================

  function renderUnits() {
    const map = new Map();

    function getComputerUnit(row) {
      const candidates = [
        row?.kode_unit,
        row?.kodeUnit,
        row?.unit,
        row?.Unit
      ];

      for (const candidate of candidates) {
        const value = String(candidate || "").trim();

        if (value && !value.includes("*")) {
          return value.split("-")[0].trim();
        }
      }

      const pengguna = String(
        row?.pengguna || row?.Pengguna || ""
      ).trim();

      if (
        pengguna &&
        !pengguna.includes("*") &&
        pengguna.includes("-")
      ) {
        return pengguna.split("-")[0].trim();
      }

      return "";
    }

    function add(raw, type) {
      const value = String(raw || "").trim();
      if (!value) return;

      const label = value
        .split("-")[0]
        .trim()
        .toLocaleUpperCase("id-ID");

      if (!label) return;

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
      .forEach(row => add(getComputerUnit(row), "computers"));

    state.printers
      .filter(row => !archived(row))
      .forEach(row => add(row.unit || row.Unit, "printers"));

    const rows = [...map.values()].sort(
      (a, b) => a.label.localeCompare(b.label, "id")
    );

    const container = $("#unitMonitoring");
    if (!container) return;

    container.innerHTML = rows.length
      ? `
        <div class="dashboard-unit-grid">
          ${rows.map(unit => `
            <div class="dashboard-unit-card">
              <strong>${esc(unit.label)}</strong>
              <div class="dashboard-unit-counts">
                <span class="unit-computer">
                  ${iconSvg("computer")}
                  <b>${unit.computers}</b>
                </span>
                <span class="unit-printer">
                  ${iconSvg("printer")}
                  <b>${unit.printers}</b>
                </span>
              </div>
            </div>
          `).join("")}
        </div>
      `
      : `
        <div class="dashboard-empty">Belum ada data unit.</div>
      `;
  }

  // =======================================================
  // PENCARIAN DATA INVENTARIS
  // =======================================================

  function inventoryDevices() {
    return [
      ...state.computers.map(row => ({
        type: "komputer",
        serial: row.serial || "",
        name: row.komputer || "",
        model: row.model || row.Model || "",
        merek: row.manufacturer || row.merek || row.Merek || ""
      })),

      ...state.printers.map(row => ({
        type: "printer",
        serial: row.serial || "",
        name: row.unit || "",
        model: row.model || row.Model || "",
        merek: row.merek || row.Merek || row.manufacturer || ""
      }))
    ];
  }

  function inventoryMap() {
    const map = new Map();

    inventoryDevices().forEach(device => {
      const serialKey = keyOf(device.type, device.serial, "");
      const nameKey = keyOf(device.type, "", device.name);

      if (serialKey) map.set(serialKey, device);

      if (nameKey && !map.has(nameKey)) {
        map.set(nameKey, device);
      }
    });

    return map;
  }

  function findInventoryDevice(row, map) {
    const type = typeOf(row?.jenis_aset);
    if (!type) return null;

    const serialKey = keyOf(type, row?.serial, "");

    if (serialKey && map.has(serialKey)) {
      return map.get(serialKey);
    }

    const nameKey = keyOf(type, "", row?.nama_aset);

    if (nameKey && map.has(nameKey)) {
      return map.get(nameKey);
    }

    return null;
  }

  function getDeviceModel(row, map) {
    const inventory = findInventoryDevice(row, map);

    return String(
      row?.model ||
      row?.Model ||
      inventory?.model ||
      ""
    ).trim();
  }

  // =======================================================
  // AKTIVITAS MAINTENANCE TERBARU
  // =======================================================

  function renderActivities(map) {
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

    const adminView = isDashboardAdmin();

    $("#latestMaintenance").innerHTML = rows.length
      ? `
        <div class="dashboard-activity-list">
          ${rows.map(({ row, date }) => {
            const type = typeOf(row.jenis_aset);
            const isComputer = type === "komputer";

            const name = isComputer && !adminView
              ? "Komputer"
              : (
                  row.nama_aset ||
                  (type === "printer" ? "Printer" : "Komputer")
                );

            const model = isComputer && !adminView
              ? ""
              : (getDeviceModel(row, map) || "Model tidak tersedia");

            const serial = isComputer && !adminView
              ? ""
              : (row.serial || "");

            const activity =
              row.jenis_kegiatan ||
              row.kegiatan ||
              "Maintenance";

            const detail = [
              model,
              serial
            ].filter(Boolean).map(esc).join(" · ");

            return `
              <div class="dashboard-activity-item">
                <span class="dashboard-activity-icon ${type}">
                  ${iconSvg(type === "printer" ? "printer" : "computer")}
                </span>

                <div class="dashboard-activity-info">
                  <strong>${esc(name)}</strong>
                  ${detail ? `<span>${detail}</span>` : ""}
                  <small>
                    ${esc(activity)}
                    ·
                    ${esc(row.kondisi || "Kondisi belum diisi")}
                  </small>
                  <time>${esc(fmtDateTime(date))}</time>
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
  // CATATAN MAINTENANCE TERBARU PER PERANGKAT
  // =======================================================

  function latestMaintenanceMap(filter) {
    const map = new Map();

    state.maintenance
      .map(row => ({
        row,
        activity: dateOf(row.Tanggal),
        created: dateOf(row["Waktu Dibuat"]),
        fallback: dateOf(activityDate(row))
      }))
      .filter(item =>
        item.fallback &&
        (!filter || filter(item.row))
      )
      .sort((a, b) => {
        const activityDiff =
          (b.activity?.getTime() || 0) -
          (a.activity?.getTime() || 0);

        if (activityDiff !== 0) return activityDiff;

        return (
          (b.created?.getTime() || 0) -
          (a.created?.getTime() || 0)
        );
      })
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
  // 10 DATA PER HALAMAN + NAVIGASI IKON
  // =======================================================

  function renderSchedules(map) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    const latestCare = latestMaintenanceMap(row =>
      activityType(row) === "perawatan"
    );

    const schedules = [...latestCare.values()]
      .map(row => ({
        row,
        date: dateOf(row.jadwal)
      }))
      .filter(item => item.date)
      .sort((a, b) => a.date - b.date);

    const late = schedules.filter(item => item.date < today);

    const soon = schedules.filter(
      item => item.date >= today && item.date <= limit
    );

    const later = schedules.filter(item => item.date > limit);

    const perPage = 10;
    const totalPages = Math.ceil(schedules.length / perPage);

    schedulePage = Math.min(
      schedulePage,
      Math.max(0, totalPages - 1)
    );

    const startIndex = schedulePage * perPage;
    const endIndex = Math.min(
      startIndex + perPage,
      schedules.length
    );

    const visibleSchedules = schedules.slice(startIndex, endIndex);
    const adminView = isDashboardAdmin();

    const list = visibleSchedules.map(({ row, date }) => {
      const type = typeOf(row.jenis_aset);
      const device = findInventoryDevice(row, map);

      if (type === "komputer") {
        const computerName = adminView
          ? (device?.name || row.nama_aset || "Komputer")
          : "Komputer";

        const computerDetail = adminView
          ? [
              device?.merek ||
                row.manufacturer ||
                row.merek ||
                row.Merek ||
                "Merek tidak tersedia",
              getDeviceModel(row, map) || "Model tidak tersedia",
              device?.serial || row.serial || "-"
            ].map(esc).join(" - ")
          : "Spesifikasi disembunyikan untuk publik";

        return `
          <div class="dashboard-schedule-item">
            <div>
              <strong>${esc(computerName)}</strong>
              <small>${computerDetail}</small>
            </div>
            <time>${esc(fmtDate(date))}</time>
          </div>
        `;
      }

      const printerUnit = device?.name ||
        row.nama_aset ||
        "Printer";

      const printerBrand = device?.merek ||
        row.merek ||
        row.Merek ||
        "Merek tidak tersedia";

      const printerModel = device?.model ||
        row.model ||
        row.Model ||
        "Model tidak tersedia";

      const printerSerial = device?.serial ||
        row.serial ||
        "-";

      return `
        <div class="dashboard-schedule-item">
          <div>
            <strong>${esc(printerUnit)}</strong>
            <small>
              ${esc(printerBrand)} - ${esc(printerModel)} - ${esc(printerSerial)}
            </small>
          </div>
          <time>${esc(fmtDate(date))}</time>
        </div>
      `;
    }).join("");

    const pagination = totalPages > 1
      ? `
        <div class="dashboard-schedule-pagination"
          style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;">

          <small style="color:var(--text-secondary,#888);">
            ${startIndex + 1}–${endIndex} dari ${schedules.length} jadwal
          </small>

          <div style="display:flex;gap:8px;">
            <button
              type="button"
              id="schedulePrev"
              aria-label="Halaman sebelumnya"
              title="Sebelumnya"
              ${schedulePage === 0 ? "disabled" : ""}
              style="width:34px;height:34px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${schedulePage === 0 ? "0.4" : "1"};">

              <svg viewBox="0 0 24 24" width="18" height="18"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>

            <button
              type="button"
              id="scheduleNext"
              aria-label="Halaman berikutnya"
              title="Berikutnya"
              ${schedulePage >= totalPages - 1 ? "disabled" : ""}
              style="width:34px;height:34px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${schedulePage >= totalPages - 1 ? "0.4" : "1"};">

              <svg viewBox="0 0 24 24" width="18" height="18"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      `
      : schedules.length
        ? `<small class="dashboard-more">${schedules.length} jadwal</small>`
        : "";

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
          ? `<div class="dashboard-schedule-list">${list}</div>`
          : `
            <div class="dashboard-empty">
              Belum ada jadwal perawatan.
            </div>
          `
      }

      ${pagination}
    `;

    $("#schedulePrev")?.addEventListener("click", () => {
      if (schedulePage > 0) {
        schedulePage--;
        renderSchedules(map);
      }
    });

    $("#scheduleNext")?.addEventListener("click", () => {
      if (schedulePage < totalPages - 1) {
        schedulePage++;
        renderSchedules(map);
      }
    });
  }

  // =======================================================
  // KONDISI PERANGKAT
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

    const computerArchive = Number(state.archiveCounts.computers || 0);
    const printerArchive = Number(state.archiveCounts.printers || 0);

    groups.komputer.bad += computerArchive;
    groups.printer.bad += printerArchive;

    const rows = [
      { key: "baik", label: "Baik" },
      { key: "attention", label: "Perlu Perhatian" },
      { key: "bad", label: "Rusak" },
      { key: "unknown", label: "Belum Ada Data Kondisi" }
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
          <strong>${iconSvg("computer")} Komputer</strong>
          <strong>${iconSvg("printer")} Printer</strong>
        </div>

        ${rows.map(item => `
          <div class="condition-table-row">
            <span class="condition-name">
              <i class="condition-indicator ${item.key}"></i>
              ${item.label}
            </span>
            <strong>${groups.komputer[item.key]}</strong>
            <strong>${groups.printer[item.key]}</strong>
          </div>
        `).join("")}
      </div>

      <div class="dashboard-condition-footer">
        <span>
          <b>${iconSvg("computer")}</b>
          Komputer: ${komputerAktif} aktif · ${computerArchive} arsip
        </span>
        <span>
          <b>${iconSvg("printer")}</b>
          Printer: ${printerAktif} aktif · ${printerArchive} arsip
        </span>
      </div>
    `;
  }

  // =======================================================
  // PESAN ERROR
  // =======================================================

  function renderError(error) {
    const message = esc(
      error?.message || "Terjadi kesalahan saat mengambil data."
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

    const map = inventoryMap();

    renderStats();
    renderUnits();
    renderActivities(map);
    renderSchedules(map);
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
      console.error("Dashboard gagal dimuat:", error);
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

    document.addEventListener(
      "techops:authchange",
      refresh
    );

    refresh();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.DashboardPage = {
    refresh,
    render,
    getState: () => state
  };

})();
