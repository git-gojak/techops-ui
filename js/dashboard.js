/* GoJak TechOps — Dashboard
   Redesign Batch 3 | fitur dan sumber data mengikuti dashboard lama.
   Tidak mengubah API, autentikasi, atau backend.
*/
(function () {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const state = {
    computers: [], printers: [], maintenance: [],
    archiveCounts: { computers: 0, printers: 0 },
    lastUpdated: null, loading: false
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

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

    let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return new Date(
      +m[3], +m[2]-1, +m[1],
      +(m[4]||0), +(m[5]||0), +(m[6]||0)
    );

    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return new Date(
      +m[1], +m[2]-1, +m[3],
      +(m[4]||0), +(m[5]||0), +(m[6]||0)
    );

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
    return d ? new Intl.DateTimeFormat("id-ID", {
      day:"2-digit", month:"short", year:"numeric"
    }).format(d) : "Tanggal tidak tersedia";
  }

  function fmtDateTime(value) {
    const d = dateOf(value);
    return d ? new Intl.DateTimeFormat("id-ID", {
      day:"2-digit", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    }).format(d) : "Waktu tidak tersedia";
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
      : s.slice(0,2) + "*".repeat(s.length-4) + s.slice(-2);
  }

  function typeOf(value) {
    const s = String(value || "").trim().toLowerCase();
    if (["komputer","computer","pc"].includes(s)) return "komputer";
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

  function timeout(promise, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(label + " tidak merespons.")),
        20000
      );

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

    state.lastUpdated = new Date();
    setOnline(true);
  }

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

    if (!$("#dashboardMeta", page)) {
      lower.insertAdjacentHTML("beforebegin", `
        <div class="dashboard-meta" id="dashboardMeta">
          <span>
            <i class="dashboard-meta-dot"></i>
            <span id="dashboardUpdateText">Menunggu data...</span>
          </span>
          <button
            type="button"
            class="dashboard-refresh"
            id="dashboardRefresh"
          >↻ Perbarui Data</button>
        </div>
      `);
    }
  }

  function renderStats() {
    const c = state.computers.filter(r => !archived(r));
    const p = state.printers.filter(r => !archived(r));
    const m = state.maintenance;
    const year = new Date().getFullYear();

    $("#totalComputers").textContent = c.length;
    $("#totalPrinters").textContent = p.length;
    $("#totalMaintenance").textContent = m.length;

    $("#computerAcquired").textContent =
      c.filter(r => yearOf(r.tahun) === year).length;

    $("#printerAcquired").textContent =
      p.filter(r => yearOf(r.ftp) === year).length;

    $("#computerArchived").textContent =
      state.archiveCounts.computers;

    $("#printerArchived").textContent =
      state.archiveCounts.printers;

    $("#totalCare").textContent = m.filter(row =>
      String(row.jenis_kegiatan || row.kegiatan || "")
        .trim().toLowerCase() === "perawatan"
    ).length;

    $("#totalRepair").textContent = m.filter(row =>
      String(row.jenis_kegiatan || row.kegiatan || "")
        .trim().toLowerCase() === "perbaikan"
    ).length;

    setOnline(true);
  }

  function renderUnits() {
    const map = new Map();

    function add(raw, type) {
      const s = String(raw || "").trim();
      if (!s) return;

      const label = (
        type === "computers" && s.includes("-")
          ? s.split("-")[0]
          : s
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
      .filter(r => !archived(r))
      .forEach(r => add(r.pengguna, "computers"));

    state.printers
      .filter(r => !archived(r))
      .forEach(r => add(r.unit, "printers"));

    const rows = [...map.values()]
      .sort((a,b) => a.label.localeCompare(b.label, "id"));

    $("#unitMonitoring").innerHTML = rows.length ? `
      <div class="dashboard-unit-grid">
        ${rows.map(u => `
          <div class="dashboard-unit-card">
            <strong>${esc(u.label)}</strong>
            <div class="dashboard-unit-counts">
              <span class="unit-computer">
                ▣ <b>${u.computers}</b>
              </span>
              <span class="unit-printer">
                ▤ <b>${u.printers}</b>
              </span>
            </div>
          </div>
        `).join("")}
      </div>
    ` : `
      <div class="dashboard-empty">
        Belum ada data unit.
      </div>
    `;
  }

  function inventoryModels() {
    const map = new Map();

    [
      ...state.computers.map(r => ({
        type: "komputer",
        serial: r.serial,
        name: r.komputer,
        model: r.model || r.Model
      })),
      ...state.printers.map(r => ({
        type: "printer",
        serial: r.serial,
        name: r.unit,
        model: r.model || r.Model
      }))
    ].forEach(d => {
      const k = keyOf(d.type, d.serial, d.name);
      if (k && d.model) map.set(k, d.model);
    });

    return map;
  }

  function renderActivities(models) {
    const rows = state.maintenance
      .map(row => ({
        row,
        date: dateOf(activityDate(row))
      }))
      .sort((a,b) =>
        (b.date?.getTime() || 0) -
        (a.date?.getTime() || 0)
      )
      .slice(0,5);

    $("#latestMaintenance").innerHTML = rows.length ? `
      <div class="dashboard-activity-list">
        ${rows.map(({row,date}) => {
          const type = typeOf(row.jenis_aset);

          const name = type === "komputer"
            ? maskComputer(row.nama_aset)
            : (row.nama_aset || "Printer");

          const model =
            row.model ||
            row.Model ||
            models.get(keyOf(type,row.serial,row.nama_aset)) ||
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
                  ${esc(model)} · ${esc(maskSerial(row.serial))}
                </span>
                <small>
                  ${esc(activity)} ·
                  ${esc(row.kondisi || "Kondisi belum diisi")}
                </small>
                <time>${esc(fmtDateTime(date))}</time>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="dashboard-empty">
        Belum ada aktivitas Maintenance.
      </div>
    `;
  }

  function latestMaintenanceMap(filter) {
    const map = new Map();

    state.maintenance
      .map(row => ({
        row,
        date: dateOf(activityDate(row))
      }))
      .filter(x => x.date && (!filter || filter(x.row)))
      .sort((a,b) => b.date - a.date)
      .forEach(({row}) => {
        const k = keyOf(
          row.jenis_aset,
          row.serial,
          row.nama_aset
        );

        if (k && !map.has(k)) {
          map.set(k,row);
        }
      });

    return map;
  }

  function renderSchedules(models) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const limit = new Date(today);
    limit.setDate(limit.getDate()+30);

    const latestCare = latestMaintenanceMap(row =>
      String(row.jenis_kegiatan || row.kegiatan || "")
        .trim().toLowerCase() === "perawatan"
    );

    const schedules = [...latestCare.values()]
      .map(row => ({
        row,
        date: dateOf(row.jadwal)
      }))
      .filter(x => x.date)
      .sort((a,b) => a.date-b.date);

    const late = schedules.filter(x => x.date < today);
    const soon = schedules.filter(
      x => x.date >= today && x.date <= limit
    );
    const later = schedules.filter(x => x.date > limit);

    const list = schedules.slice(0,8).map(({row,date}) => {
      const type = typeOf(row.jenis_aset);

      const name = type === "komputer"
        ? maskComputer(row.nama_aset)
        : (row.nama_aset || "Printer");

      const model =
        row.model ||
        row.Model ||
        models.get(keyOf(type,row.serial,row.nama_aset)) ||
        "Model tidak tersedia";

      return `
        <div class="dashboard-schedule-item">
          <div>
            <strong>${esc(name)}</strong>
            <small>
              ${esc(type || "Perangkat")} · ${esc(model)}
            </small>
          </div>
          <time>${esc(fmtDate(date))}</time>
        </div>
      `;
    }).join("");

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

      ${list ? `
        <div class="dashboard-schedule-list">
          ${list}
        </div>
      ` : `
        <div class="dashboard-empty">
          Belum ada jadwal perawatan.
        </div>
      `}

      ${schedules.length > 8 ? `
        <small class="dashboard-more">
          Menampilkan 8 dari ${schedules.length} jadwal.
        </small>
      ` : ""}
    `;
  }

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
        .filter(r => !archived(r))
        .map(r => ({
          type: "komputer",
          serial: r.serial,
          name: r.komputer
        })),

      ...state.printers
        .filter(r => !archived(r))
        .map(r => ({
          type: "printer",
          serial: r.serial,
          name: r.unit
        }))
    ];

    devices.forEach(d => {
      const c = String(
        latest.get(keyOf(d.type,d.serial,d.name))?.kondisi || ""
      ).trim().toLowerCase();

      const bucket =
        c === "baik" ? "baik" :
        c === "perlu perhatian" ? "attention" :
        c === "rusak" ? "bad" :
        "unknown";

      groups[d.type][bucket]++;
    });

    const labels = [
      ["baik","Baik"],
      ["attention","Perlu Perhatian"],
      ["bad","Rusak"],
      ["unknown","Belum Ada Data Kondisi"]
    ];

    function column(type,title,archiveCount) {
      const g = groups[type];

      const totalBad =
        g.bad + Number(archiveCount || 0);

      const values = {
        baik: g.baik,
        attention: g.attention,
        bad: totalBad,
        unknown: g.unknown
      };

      const activeCount = type === "komputer"
        ? state.computers.filter(r => !archived(r)).length
        : state.printers.filter(r => !archived(r)).length;

      return `
        <section class="dashboard-condition-column">
          <h4>${title}</h4>

          ${labels.map(([k,label]) => `
            <div class="dashboard-condition-row">
              <span>
                <i class="condition-indicator ${k}"></i>
                ${label}
              </span>
              <strong>${values[k]}</strong>
            </div>
          `).join("")}

          <small>
            ${activeCount} aktif · ${archiveCount} arsip
          </small>
        </section>
      `;
    }

    $("#dashboardConditions").innerHTML = `
      <div class="dashboard-condition-grid">
        ${column(
          "komputer",
          "Komputer",
          state.archiveCounts.computers
        )}

        ${column(
          "printer",
          "Printer",
          state.archiveCounts.printers
        )}
      </div>

      <p class="dashboard-condition-note">
        Kondisi perangkat aktif mengikuti catatan Maintenance terbaru.
        Perangkat arsip tetap dihitung dalam kategori Rusak,
        sesuai dashboard lama.
      </p>
    `;
  }

  function renderMeta() {
    const el = $("#dashboardUpdateText");

    if (el) {
      el.textContent = state.lastUpdated
        ? "Data diperbarui " + fmtDateTime(state.lastUpdated)
        : "Data belum diperbarui";
    }
  }

  function renderError(error) {
    const message = esc(
      error?.message || "Terjadi kesalahan saat mengambil data."
    );

    [
      "#unitMonitoring",
      "#dashboardSchedules",
      "#latestMaintenance",
      "#dashboardConditions"
    ].forEach(sel => {
      const el = $(sel);

      if (el) {
        el.innerHTML = `
          <div class="dashboard-error">
            Data belum dapat dimuat.
            <small>${message}</small>
          </div>
        `;
      }
    });

    setOnline(false);
  }

  function render() {
    ensureLayout();

    const models = inventoryModels();

    renderStats();
    renderUnits();
    renderActivities(models);
    renderSchedules(models);
    renderConditions();
    renderMeta();
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const button = $("#dashboardRefresh");

    if (button) {
      button.disabled = true;
      button.textContent = "Memuat...";
    }

    try {
      await loadData();
      render();
    } catch (error) {
      console.error("Dashboard gagal dimuat:", error);
      renderError(error);
    } finally {
      state.loading = false;

      const b = $("#dashboardRefresh");

      if (b) {
        b.disabled = false;
        b.textContent = "↻ Perbarui Data";
      }
    }
  }

  function init() {
    ensureLayout();

    document.addEventListener("click", e => {
      if (e.target.closest("#dashboardRefresh")) {
        refresh();
      }
    });

    document.addEventListener("techops:authchange", refresh);

    refresh();
  }

  document.addEventListener("DOMContentLoaded", init);

  window.DashboardPage = {
    refresh,
    render,
    getState: () => state
  };
})();
