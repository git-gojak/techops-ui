
/* =========================================================
   GOJAK TECHOPS
   DASHBOARD - DETAIL JADWAL, SENSOR, DAN KONDISI
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
      <svg viewBox="0 0 24 24"
        width="21" height="21"
        fill="none" stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
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

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true ||
      window.TechOpsAPI?.isAuthenticated?.() === true;
  }

  function maskValue(value) {
    const s = String(value || "").trim();

    if (!s) return "-";
    if (isAdmin()) return s;

    return s.length <= 4
      ? "*".repeat(s.length)
      : "*".repeat(s.length - 4) + s.slice(-4);
  }

  function maskSerial(value) {
    return maskValue(value);
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

  function maskComputerModel(value) {
    return maskValue(value);
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

    const includeArchived =
      TechOpsAPI.isAuthenticated();

    const result = await Promise.all([
      timeout(
        TechOpsAPI.get("computers.list", {
          includeArchived
        }),
        "Data komputer"
      ),

      timeout(
        TechOpsAPI.get("printers.list", {
          includeArchived
        }),
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
          <div class="stat-icon blue">
            ${iconSvg("computer")}
          </div>
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
          <div class="stat-icon teal">
            ${iconSvg("printer")}
          </div>
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
          <div class="stat-icon purple">
            ${iconSvg("maintenance")}
          </div>
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
          <div class="stat-icon green">
            ${iconSvg("connection")}
          </div>
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

    // Pertahankan kartu yang sudah ada. Jangan mengganti seluruh
    // lower grid karena kartu Monitoring Unit dan Aktivitas sudah ada.

    if (!$("#dashboardSchedules", lower)) {
      const card = document.createElement("article");
      card.className = "glass-card dash-panel";
      card.innerHTML = `
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
      `;

      const activityCard = $("#latestMaintenance", lower)
        ?.closest(".glass-card");

      if (activityCard) {
        lower.insertBefore(card, activityCard);
      } else {
        lower.appendChild(card);
      }
    }

    // Kartu Kondisi Perangkat tetap tersedia seperti perilaku
    // dashboard sebelumnya, tanpa membangun ulang kartu lain.
    if (!$("#dashboardConditions", lower)) {
      const card = document.createElement("article");
      card.className = "glass-card dash-panel";
      card.innerHTML = `
        <div class="card-heading">
          <div>
            <h3>Kondisi Perangkat</h3>
            <p>Berdasarkan catatan Maintenance terbaru</p>
          </div>
        </div>
        <div id="dashboardConditions"></div>
      `;
      lower.appendChild(card);
    }
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

    $("#totalComputers").textContent = computers.length;
    $("#totalPrinters").textContent = printers.length;
    $("#totalMaintenance").textContent = maintenance.length;

    $("#computerAcquired").textContent =
      computers.filter(row => yearOf(row.tahun) === year).length;

    $("#printerAcquired").textContent =
      printers.filter(row => yearOf(row.ftp) === year).length;

    $("#computerArchived").textContent =
      state.archiveCounts.computers;

    $("#printerArchived").textContent =
      state.archiveCounts.printers;

    $("#totalCare").textContent =
      maintenance.filter(row =>
        activityType(row) === "perawatan"
      ).length;

    $("#totalRepair").textContent =
      maintenance.filter(row =>
        activityType(row) === "perbaikan"
      ).length;

    setOnline(true);
  }

  // =======================================================
  // MONITORING UNIT - DIPERTAHANKAN
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
      .forEach(row => add(row.pengguna, "computers"));

    state.printers
      .filter(row => !archived(row))
      .forEach(row => add(row.unit, "printers"));

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
        <div class="dashboard-empty">
          Belum ada data unit.
        </div>
      `;
  }

  // =======================================================
  // PENCARIAN DATA INVENTARIS
  // Khusus kebutuhan dua kartu Maintenance
  // =======================================================

  function fieldValue(row, names) {
    for (const name of names) {
      const value = row?.[name];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return String(value).trim();
      }
    }

    return "";
  }

  function inventoryDevices() {
    return [
      ...state.computers.map(row => ({
        type: "komputer",

        serial: fieldValue(row, [
          "serial", "Serial", "sn_asset", "SN Asset",
          "asset_serial_id", "Asset/Serial ID"
        ]),

        name: fieldValue(row, [
          "komputer", "Computer Name",
          "computer_name", "nama_aset"
        ]),

        model: fieldValue(row, [
          "model", "Model", "model_aset", "Model Aset"
        ]),

        merek: fieldValue(row, [
          "manufacturer", "Manufacturer",
          "merek", "Merek"
        ])
      })),

      ...state.printers.map(row => ({
        type: "printer",

        serial: fieldValue(row, [
          "serial", "Serial", "sn_asset", "SN Asset",
          "asset_serial_id", "Asset/Serial ID"
        ]),

        name: fieldValue(row, [
          "unit", "nama_aset", "Nama Aset", "printer"
        ]),

        model: fieldValue(row, [
          "model", "Model", "model_aset", "Model Aset"
        ]),

        merek: fieldValue(row, [
          "merek", "Merek", "manufacturer", "Manufacturer"
        ])
      }))
    ];
  }

  function inventoryMap() {
    const map = new Map();

    inventoryDevices().forEach(device => {
      const serialKey = keyOf(
        device.type,
        device.serial,
        ""
      );

      const nameKey = keyOf(
        device.type,
        "",
        device.name
      );

      if (serialKey) {
        map.set(serialKey, device);
      }

      if (nameKey && !map.has(nameKey)) {
        map.set(nameKey, device);
      }
    });

    return map;
  }

  function findInventoryDevice(row, map) {
    const type = typeOf(fieldValue(row, [
      "jenis_aset", "Jenis Aset",
      "jenis aset", "tipe_aset"
    ]));

    if (!type) return null;

    const serial = fieldValue(row, [
      "serial", "Serial", "sn_asset", "SN Asset",
      "asset_serial_id", "Asset/Serial ID"
    ]);

    const name = fieldValue(row, [
      "nama_aset", "Nama Aset", "komputer",
      "Computer Name", "unit", "nama_perangkat"
    ]);

    const serialKey = keyOf(type, serial, "");

    if (serialKey && map.has(serialKey)) {
      return map.get(serialKey);
    }

    const nameKey = keyOf(type, "", name);

    if (nameKey && map.has(nameKey)) {
      return map.get(nameKey);
    }

    return null;
  }

  function getDeviceModel(row, map) {
    const inventory = findInventoryDevice(row, map);

    return fieldValue(row, [
      "model", "Model", "model_aset", "Model Aset",
      "model_perangkat", "Model Perangkat"
    ]) || inventory?.model || "";
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

    $("#latestMaintenance").innerHTML = rows.length
      ? `
        <div class="dashboard-activity-list">
          ${rows.map(({ row, date }) => {
            const type = typeOf(fieldValue(row, [
              "jenis_aset", "Jenis Aset",
              "jenis aset", "tipe_aset"
            ]));

            const device = findInventoryDevice(row, map);

            const rawName = fieldValue(row, [
              "nama_aset", "Nama Aset", "komputer",
              "Computer Name", "unit", "nama_perangkat"
            ]) || device?.name || "";

            // Nama komputer disensor untuk publik.
            // Admin tetap melihat nama lengkap.
            const name = type === "komputer"
              ? maskComputer(rawName || "Komputer")
              : (rawName || "Printer");

            const rawModel = getDeviceModel(row, map);

            // Model komputer disensor untuk publik.
            // Model printer tetap terlihat untuk publik.
            const model = !rawModel
              ? "Model tidak tersedia"
              : type === "komputer"
                ? maskComputerModel(rawModel)
                : rawModel;

            const activity =
              row.jenis_kegiatan ||
              row.kegiatan ||
              "Maintenance";

            return `
              <div class="dashboard-activity-item">
                <span class="dashboard-activity-icon ${type}">
                  ${iconSvg(
                    type === "printer" ? "printer" : "computer"
                  )}
                </span>

                <div class="dashboard-activity-info">
                  <strong>${esc(name)}</strong>

                  <span>${esc(model)}</span>

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
  // PERAWATAN TERBARU PER PERANGKAT UNTUK JADWAL
  // Menggunakan Waktu Dibuat sebagai acuan utama.
  // =======================================================

  function scheduleDeviceKey(row, map) {
    const type = typeOf(fieldValue(row, [
      "jenis_aset", "Jenis Aset",
      "jenis aset", "tipe_aset"
    ]));

    if (!type) return "";

    const device = findInventoryDevice(row, map);

    const serial = fieldValue(row, [
      "serial", "Serial", "sn_asset", "SN Asset",
      "asset_serial_id", "Asset/Serial ID"
    ]) || device?.serial || "";

    const name = fieldValue(row, [
      "nama_aset", "Nama Aset", "komputer",
      "Computer Name", "unit", "nama_perangkat"
    ]) || device?.name || "";

    const identity = String(serial || name).trim().toUpperCase();
    return identity ? type + "|" + identity : "";
  }

  function latestCareForSchedule(map) {
    const latest = new Map();

    state.maintenance
      .filter(row => activityType(row) === "perawatan")
      .map(row => ({
        row,
        key: scheduleDeviceKey(row, map),
        timestamp:
          dateOf(row["Waktu Dibuat"]) ||
          dateOf(row.Tanggal) ||
          dateOf(activityDate(row))
      }))
      .filter(item => item.key && item.timestamp)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .forEach(item => {
        if (!latest.has(item.key)) {
          latest.set(item.key, item.row);
        }
      });

    return [...latest.values()];
  }

  // =======================================================
  // MONITORING JADWAL MAINTENANCE
  // =======================================================

  function renderSchedules(map) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    const schedules = latestCareForSchedule(map)
      .map(row => ({
        row,
        date: dateOf(fieldValue(row, [
          "jadwal", "Jadwal",
          "tanggal_jadwal", "Tanggal Jadwal"
        ]))
      }))
      .filter(item => item.date)
      .sort((a, b) => a.date - b.date);

    const late = schedules.filter(item => {
      const date = new Date(item.date);
      date.setHours(0, 0, 0, 0);
      return date < today;
    });

    const soon = schedules.filter(item => {
      const date = new Date(item.date);
      date.setHours(0, 0, 0, 0);
      return date >= today && date <= limit;
    });

    const later = schedules.filter(item => {
      const date = new Date(item.date);
      date.setHours(0, 0, 0, 0);
      return date > limit;
    });

    const list = schedules
      .slice(0, 8)
      .map(({ row, date }) => {
        const type = typeOf(fieldValue(row, [
          "jenis_aset", "Jenis Aset",
          "jenis aset", "tipe_aset"
        ]));

        const device = findInventoryDevice(row, map);
        const rawModel = getDeviceModel(row, map);

        const rawSerial = fieldValue(row, [
          "serial", "Serial", "sn_asset", "SN Asset",
          "asset_serial_id", "Asset/Serial ID"
        ]) || device?.serial || "";

        // Komputer: nama, model, dan serial disensor untuk publik.
        if (type === "komputer") {
          const computerName = device?.name ||
            fieldValue(row, [
              "nama_aset", "Nama Aset", "komputer",
              "Computer Name", "nama_perangkat"
            ]) ||
            "Komputer";

          const model = rawModel
            ? maskComputerModel(rawModel)
            : "Model tidak tersedia";

          return `
            <div class="dashboard-schedule-item">
              <div>
                <strong>${esc(maskComputer(computerName))}</strong>

                <small>
                  Model: ${esc(model)}
                  · Serial: ${esc(maskSerial(rawSerial))}
                </small>
              </div>

              <time>${esc(fmtDate(date))}</time>
            </div>
          `;
        }

        // Printer: merek dan model terlihat, serial disensor.
        const printerUnit = device?.name ||
          fieldValue(row, [
            "nama_aset", "Nama Aset", "unit", "nama_perangkat"
          ]) ||
          "Printer";

        const printerBrand = device?.merek ||
          fieldValue(row, [
            "merek", "Merek", "manufacturer"
          ]) ||
          "Merek tidak tersedia";

        const printerModel = rawModel ||
          "Model tidak tersedia";

        return `
          <div class="dashboard-schedule-item">
            <div>
              <strong>${esc(printerUnit)}</strong>

              <small>
                Merek: ${esc(printerBrand)}
                · Model: ${esc(printerModel)}
                · Serial: ${esc(maskSerial(rawSerial))}
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
          ? `<div class="dashboard-schedule-list">${list}</div>`
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
  // KONDISI PERANGKAT - DIPERTAHANKAN
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

    // Arsip tetap masuk kategori Rusak
    // mengikuti perilaku Dashboard lama.
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
          <strong>
            ${iconSvg("computer")}
            Komputer
          </strong>
          <strong>
            ${iconSvg("printer")}
            Printer
          </strong>
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
          Komputer: ${komputerAktif} aktif
          · ${computerArchive} arsip
        </span>

        <span>
          <b>${iconSvg("printer")}</b>
          Printer: ${printerAktif} aktif
          · ${printerArchive} arsip
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

    // Pesan error hanya mengubah dua kartu Maintenance.
    [
      "#dashboardSchedules",
      "#latestMaintenance"
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
