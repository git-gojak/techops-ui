
/* =========================================================
   GOJAK TECHOPS
   EVALUASI PERANGKAT — TAHAP PEMERIKSAAN DATA

   Fungsi:
   - Membaca data komputer dan printer.
   - Membaca riwayat Maintenance.
   - Menghitung usia komputer dan MP printer.
   - Menghitung jumlah Perbaikan dan Perawatan.
   - Menampilkan data untuk analisis sebelum kategori final.

   Tidak mengubah atau menyimpan data ke database.
   ========================================================= */

(function () {
  "use strict";

  const root = document.getElementById("evaluationRoot");

  if (!root) {
    console.warn("Evaluasi: evaluationRoot tidak ditemukan.");
    return;
  }

  const state = {
    computers: [],
    printers: [],
    maintenance: [],
    type: "computers",
    query: "",
    loading: false,
    loaded: false,
    lastUpdated: null
  };

  const $ = (selector, parent = root) =>
    parent.querySelector(selector);

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

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;

    return [];
  }

  function icon(name) {
    return window.TechOpsIcons
      ? window.TechOpsIcons.render(name)
      : "";
  }

  function isAdmin() {
    return Boolean(
      window.TechOpsAPI &&
      window.TechOpsAPI.isAuthenticated()
    );
  }

  function serialKey(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase();
  }

  function activityType(row) {
    return String(
      row?.jenis_kegiatan || row?.kegiatan || ""
    ).trim().toLowerCase();
  }

  function assetType(row) {
    const value = String(
      row?.jenis_aset || ""
    ).trim().toLowerCase();

    if (
      value === "komputer" ||
      value === "computer" ||
      value === "pc"
    ) return "computers";

    if (value === "printer") return "printers";

    return "";
  }

  // =======================================================
  // TANGGAL DAN USIA
  // =======================================================

  function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();
    if (!text) return null;

    let match = text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

    let year;
    let month;
    let day;

    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = text.match(
        /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
      );

      if (!match) return null;

      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function getAge(value) {
    const year = Number(String(value ?? "").trim());

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear()
    ) {
      return null;
    }

    return new Date().getFullYear() - year;
  }

  function calculateMP(value) {
    const start = parseDate(value);

    if (!start) return "-";

    const now = new Date();

    if (start > now) return "Belum dimulai";

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) {
      months--;
      days += new Date(
        now.getFullYear(),
        now.getMonth(),
        0
      ).getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} th ${months} bln ${days} hr`;
  }

  function formatDate(value) {
    const date = parseDate(value);

    if (!date) return "-";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  // =======================================================
  // RIWAYAT MAINTENANCE PER PERANGKAT
  // Pencocokan berdasarkan jenis aset dan serial.
  // =======================================================

  function getHistory(type, serial) {
    const key = serialKey(serial);

    if (!key) {
      return {
        repair: 0,
        maintenance: 0
      };
    }

    const rows = state.maintenance.filter(row => {
      return (
        assetType(row) === type &&
        serialKey(row.serial) === key
      );
    });

    return {
      repair: rows.filter(row =>
        activityType(row) === "perbaikan"
      ).length,

      maintenance: rows.filter(row =>
        activityType(row) === "perawatan"
      ).length
    };
  }

  // =======================================================
  // MEMUAT DATA
  // =======================================================

  async function loadData() {
    if (!isAdmin()) {
      throw new Error(
        "Silakan login sebagai Admin untuk memeriksa data lengkap."
      );
    }

    const results = await Promise.all([
      window.TechOpsAPI.get("computers.list", {
        includeArchived: false
      }),

      window.TechOpsAPI.get("printers.list", {
        includeArchived: false
      }),

      window.TechOpsAPI.get("maintenance.list")
    ]);

    state.computers = normalizeArray(results[0]);
    state.printers = normalizeArray(results[1]);
    state.maintenance = normalizeArray(results[2]);

    state.lastUpdated = new Date();
    state.loaded = true;
  }

  // =======================================================
  // RINGKASAN DATA
  // =======================================================

  function getSummary(rows, type) {
    let repair = 0;
    let maintenance = 0;

    rows.forEach(row => {
      const history = getHistory(type, row.serial);

      repair += history.repair;
      maintenance += history.maintenance;
    });

    return {
      total: rows.length,
      repair,
      maintenance
    };
  }

  function renderSummary(summary) {
    return `
      <div class="dashboard-grid">

        <article class="stat-card">
          <div class="stat-icon blue">
            ${icon("komputer")}
          </div>
          <div class="stat-info">
            <span>Total Perangkat</span>
            <strong>${summary.total}</strong>
            <small>Data aktif</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon purple">
            ${icon("history")}
          </div>
          <div class="stat-info">
            <span>Total Perbaikan</span>
            <strong>${summary.repair}</strong>
            <small>Riwayat tercatat</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon teal">
            ${icon("maintenance")}
          </div>
          <div class="stat-info">
            <span>Total Perawatan</span>
            <strong>${summary.maintenance}</strong>
            <small>Riwayat tercatat</small>
          </div>
        </article>

      </div>
    `;
  }

  // =======================================================
  // TABEL KOMPUTER
  // =======================================================

  function computerRows(rows) {
    return rows.map(row => {
      const history = getHistory(
        "computers",
        row.serial
      );

      const age = getAge(row.tahun);

      return `
        <tr>
          <td>
            <strong>${esc(row.komputer || "-")}</strong>
            <small>${esc(row.serial || "-")}</small>
          </td>

          <td>${esc(row.cpu || "-")}</td>

          <td>
            ${esc(row.core || "-")} /
            ${esc(row.thread || "-")}
          </td>

          <td>${esc(row.ram || "-")}</td>

          <td>${esc(row.storage || "-")}</td>

          <td>
            ${age === null ? "-" : `${age} tahun`}
            <small>Tahun: ${esc(row.tahun || "-")}</small>
          </td>

          <td>${history.repair} kali</td>

          <td>${history.maintenance} kali</td>
        </tr>
      `;
    }).join("");
  }

  // =======================================================
  // TABEL PRINTER
  // =======================================================

  function printerRows(rows) {
    return rows.map(row => {
      const history = getHistory(
        "printers",
        row.serial
      );

      return `
        <tr>
          <td>
            <strong>${esc(row.unit || "-")}</strong>
            <small>${esc(row.serial || "-")}</small>
          </td>

          <td>${esc(row.merek || "-")}</td>

          <td>${esc(row.model || "-")}</td>

          <td>${esc(row.tinta || "-")}</td>

          <td>${formatDate(row.ftp)}</td>

          <td>${calculateMP(row.ftp)}</td>

          <td>${history.repair} kali</td>

          <td>${history.maintenance} kali</td>
        </tr>
      `;
    }).join("");
  }

  // =======================================================
  // GAMBAR HALAMAN
  // =======================================================

  function render() {
    const type = state.type;
    const rows = state[type];

    const isComputer = type === "computers";

    const summary = getSummary(rows, type);

    const query = state.query
      .trim()
      .toLowerCase();

    const filtered = rows.filter(row => {
      const values = isComputer
        ? [
            row.komputer,
            row.serial,
            row.cpu,
            row.ram,
            row.storage,
            row.tahun
          ]
        : [
            row.unit,
            row.serial,
            row.merek,
            row.model,
            row.tinta,
            row.ftp
          ];

      return values.some(value =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });

    const updated = state.lastUpdated
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(state.lastUpdated)
      : "-";

    root.innerHTML = `
      <div class="inventory-page">

        <div class="inventory-heading">
          <div>
            <span class="inventory-eyebrow">
              GOJAK TECHOPS
            </span>

            <h2>Evaluasi Perangkat</h2>

            <p>
              Pemeriksaan spesifikasi dan riwayat
              pemeliharaan perangkat.
            </p>
          </div>

          <button
            type="button"
            class="inventory-button inventory-primary"
            id="evaluationRefresh"
            ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Memuat..." : "Perbarui Data"}
          </button>
        </div>

        <section class="glass-card">
          <div class="card-heading">
            <div>
              <h3>Data Pemeriksaan</h3>
              <p>
                Tahap awal sebelum menentukan kategori
                kelayakan perangkat.
              </p>
            </div>
          </div>

          <div class="maintenance-radio-group">
            <button
              type="button"
              class="inventory-button ${isComputer ? "inventory-primary" : ""}"
              data-evaluation-type="computers">
              ${icon("komputer")} Komputer
            </button>

            <button
              type="button"
              class="inventory-button ${!isComputer ? "inventory-primary" : ""}"
              data-evaluation-type="printers">
              ${icon("printer")} Printer
            </button>
          </div>
        </section>

        ${renderSummary(summary)}

        <section class="glass-card">

          <div class="card-heading">
            <div>
              <h3>
                ${isComputer
                  ? "Spesifikasi Komputer"
                  : "Data Inventaris Printer"}
              </h3>

              <p>
                ${filtered.length} dari ${rows.length}
                perangkat ditampilkan.
              </p>
            </div>
          </div>

          <div class="inventory-toolbar">
            <input
              type="search"
              class="inventory-search"
              id="evaluationSearch"
              placeholder="Cari perangkat..."
              value="${esc(state.query)}"
              autocomplete="off">
          </div>

          <div class="inventory-table-wrap">
            <table class="inventory-table">
              <thead>
                <tr>
                  ${isComputer ? `
                    <th>Komputer</th>
                    <th>CPU</th>
                    <th>Core / Thread</th>
                    <th>RAM</th>
                    <th>Storage</th>
                    <th>Usia</th>
                  ` : `
                    <th>Printer / Serial</th>
                    <th>Merek</th>
                    <th>Model</th>
                    <th>Tinta</th>
                    <th>Tanggal FTP</th>
                    <th>Masa Pakai</th>
                  `}

                  <th>Perbaikan</th>
                  <th>Perawatan</th>
                </tr>
              </thead>

              <tbody>
                ${filtered.length
                  ? (
                    isComputer
                      ? computerRows(filtered)
                      : printerRows(filtered)
                  )
                  : `
                    <tr>
                      <td colspan="8">
                        Tidak ada data yang sesuai.
                      </td>
                    </tr>
                  `
                }
              </tbody>
            </table>
          </div>

          <div class="inventory-footer">
            <span>
              Data diperbarui: ${updated}
            </span>
          </div>

        </section>

        <section class="glass-card">
          <div class="card-heading">
            <h3>Catatan Pemeriksaan</h3>
            <p>
              Hasil ini belum merupakan rekomendasi
              penggantian perangkat.
            </p>
          </div>

          <ul>
            <li>Data diambil dari inventaris aktif.</li>
            <li>Usia komputer dihitung dari Tahun Perolehan.</li>
            <li>Masa Pakai printer dihitung dari tanggal FTP.</li>
            <li>Perbaikan dan Perawatan dihitung terpisah.</li>
            <li>Riwayat dicocokkan menggunakan jenis aset dan serial.</li>
            <li>Data hanya dibaca dan tidak disimpan kembali.</li>
          </ul>
        </section>

      </div>
    `;

    bindEvents();
  }

  // =======================================================
  // EVENT HALAMAN
  // =======================================================

  function bindEvents() {
    $("#evaluationRefresh")?.addEventListener(
      "click",
      () => openPage(true)
    );

    $("#evaluationSearch")?.addEventListener(
      "input",
      event => {
        state.query = event.target.value;
        render();
      }
    );

    root.querySelectorAll("[data-evaluation-type]")
      .forEach(button => {
        button.addEventListener("click", () => {
          state.type = button.dataset.evaluationType;
          state.query = "";
          render();
        });
      });
  }

  // =======================================================
  // PESAN AKSES DAN ERROR
  // =======================================================

  function renderMessage(title, message) {
    root.innerHTML = `
      <div class="inventory-page">
        <section class="glass-card">
          <div class="card-heading">
            <h3>${esc(title)}</h3>
            <p>${esc(message)}</p>
          </div>
        </section>
      </div>
    `;
  }

  // =======================================================
  // BUKA HALAMAN
  // =======================================================

  async function openPage(forceRefresh = false) {
    if (state.loading) return;

    if (!isAdmin()) {
      renderMessage(
        "Login Admin diperlukan",
        "Evaluasi menggunakan serial lengkap untuk mencocokkan riwayat Maintenance. Silakan login Admin terlebih dahulu."
      );
      return;
    }

    if (state.loaded && !forceRefresh) {
      render();
      return;
    }

    state.loading = true;

    renderMessage(
      "Memuat data perangkat",
      "Sedang membaca inventaris dan riwayat Maintenance..."
    );

    try {
      await loadData();
      render();

    } catch (error) {
      console.error("Evaluasi perangkat:", error);

      renderMessage(
        "Data belum dapat dimuat",
        error.message || "Periksa koneksi dan coba kembali."
      );

    } finally {
      state.loading = false;
    }
  }

  // =======================================================
  // INISIALISASI DAN NAVIGASI
  // =======================================================

  document.addEventListener(
    "techops:pagechange",
    event => {
      if (event.detail?.page === "connectivity") {
        openPage();
      }
    }
  );

  document.addEventListener(
    "techops:authchange",
    () => {
      state.loaded = false;
      state.computers = [];
      state.printers = [];
      state.maintenance = [];

      if (
        window.TechOps?.getActivePage?.() === "connectivity"
      ) {
        openPage(true);
      }
    }
  );

  window.EvaluasiPerangkat = {
    openPage,
    refresh: () => openPage(true)
  };

})();
