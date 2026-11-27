/* =========================================================
   GOJAK TECHOPS
   EVALUASI PERANGKAT

   Kategori:
   - Perlu Penggantian
   - Perlu Perhatian

   Maksimal 5 perangkat per kategori untuk setiap jenis aset.

   Prinsip:
   - Kondisi Rusak pada catatan Maintenance terbaru menjadi
     indikasi kuat untuk penggantian.
   - Umur dan spesifikasi tidak menjadi alasan tunggal
     untuk merekomendasikan penggantian.
   - Riwayat Perbaikan dan Perawatan dihitung terpisah.
   - Perawatan rutin tidak otomatis dianggap kerusakan.
   - Hanya membaca data, tidak mengubah database.
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
    loading: false,
    loaded: false,
    lastUpdated: null
  };

  const $ = (selector, parent = root) =>
    parent.querySelector(selector);

  const MAX_PER_CATEGORY = 5;

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
    if (value?.success === false) {
      throw new Error(
        value.message ||
        value.error ||
        "Server gagal mengirim data."
      );
    }

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

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function numberValue(value) {
    const match = String(value ?? "")
      .replace(",", ".")
      .match(/\d+(\.\d+)?/);

    return match ? Number(match[0]) : null;
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

  function getComputerAge(value) {
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

  function getPrinterAge(value) {
    const date = parseDate(value);

    if (!date || date > new Date()) {
      return null;
    }

    const now = new Date();

    let years = now.getFullYear() - date.getFullYear();

    const anniversary = new Date(
      now.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (anniversary > now) {
      years--;
    }

    return Math.max(0, years);
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

  function formatAge(age) {
    return age === null
      ? "Usia tidak diketahui"
      : `${age} tahun`;
  }

  // =======================================================
  // IDENTIFIKASI JENIS MAINTENANCE
  // =======================================================

  function activityType(row) {
    return normalizeText(
      row?.jenis_kegiatan || row?.kegiatan || ""
    );
  }

  function assetType(row) {
    const value = normalizeText(row?.jenis_aset);

    if (
      value === "komputer" ||
      value === "computer" ||
      value === "pc"
    ) {
      return "computers";
    }

    if (value === "printer") {
      return "printers";
    }

    return "";
  }

  function maintenanceDate(row) {
    return parseDate(
      row?.Tanggal ||
      row?.tanggal ||
      row?.date
    );
  }

  // =======================================================
  // RIWAYAT PER PERANGKAT
  // Pencocokan wajib berdasarkan jenis aset dan serial.
  // =======================================================

  function getHistory(type, serial) {
    const key = serialKey(serial);

    if (!key) {
      return {
        repair: 0,
        maintenance: 0,
        latestCondition: "",
        latestDate: null,
        matched: false
      };
    }

    const rows = state.maintenance.filter(row => {
      return (
        assetType(row) === type &&
        serialKey(row.serial) === key
      );
    });

    const sorted = [...rows].sort((a, b) => {
      const dateA = maintenanceDate(a);
      const dateB = maintenanceDate(b);

      return (dateB?.getTime() || 0) -
        (dateA?.getTime() || 0);
    });

    const latest = sorted[0] || null;

    return {
      repair: rows.filter(row =>
        activityType(row) === "perbaikan"
      ).length,

      maintenance: rows.filter(row =>
        activityType(row) === "perawatan"
      ).length,

      latestCondition: normalizeText(
        latest?.kondisi || ""
      ),

      latestDate: latest
        ? maintenanceDate(latest)
        : null,

      matched: true
    };
  }

  // =======================================================
  // PENILAIAN KOMPUTER
  // =======================================================

  function evaluateComputer(row) {
    const history = getHistory(
      "computers",
      row.serial
    );

    const age = getComputerAge(row.tahun);
    const ram = numberValue(row.ram);
    const core = numberValue(row.core);

    const storage = normalizeText(row.storage);

    const hasHdd =
      /\bhdd\b|hard.?disk/.test(storage);

    const reasons = [];
    const weaknesses = [];

    const condition = history.latestCondition;

    // Kondisi terakhir tercatat Rusak.
    if (condition === "rusak") {
      reasons.push(
        "Kondisi terakhir pada riwayat Maintenance tercatat Rusak."
      );
    }

    // Keterbatasan spesifikasi.
    if (ram !== null && ram <= 4) {
      weaknesses.push(
        `RAM ${row.ram || ram + " GB"} tergolong sangat terbatas.`
      );
    } else if (ram !== null && ram <= 8) {
      weaknesses.push(
        `RAM ${row.ram} masih terbatas untuk kebutuhan kerja yang lebih berat.`
      );
    }

    if (core !== null && core <= 2) {
      weaknesses.push(
        `Prosesor hanya memiliki ${core} core.`
      );
    } else if (core !== null && core <= 4) {
      weaknesses.push(
        `Prosesor memiliki ${core} core sehingga kemampuan pemrosesan perlu diperhatikan.`
      );
    }

    if (hasHdd) {
      weaknesses.push(
        "Media penyimpanan masih menggunakan HDD."
      );
    }

    // Usia perangkat.
    if (age !== null && age >= 8) {
      weaknesses.push(
        `Usia perangkat sekitar ${age} tahun.`
      );
    } else if (age !== null && age >= 6) {
      weaknesses.push(
        `Usia perangkat sekitar ${age} tahun dan perlu dipantau.`
      );
    }

    // Riwayat perbaikan.
    if (history.repair >= 4) {
      weaknesses.push(
        `Sudah tercatat ${history.repair} kali perbaikan.`
      );
    } else if (history.repair >= 2) {
      weaknesses.push(
        `Sudah tercatat ${history.repair} kali perbaikan.`
      );
    }

    // Kondisi terakhir Perlu Perhatian.
    if (condition === "perlu perhatian") {
      reasons.push(
        "Kondisi terakhir tercatat Perlu Perhatian."
      );
    }

    let category = "";

    const severeSpecCount = [
      ram !== null && ram <= 4,
      core !== null && core <= 2
    ].filter(Boolean).length;

    const hasStrongAgeAndRepair =
      age !== null &&
      age >= 8 &&
      history.repair >= 2 &&
      weaknesses.length >= 2;

    const hasRepeatedRepairAndWeakSpec =
      age !== null &&
      age >= 6 &&
      history.repair >= 2 &&
      (
        severeSpecCount >= 1 ||
        hasHdd
      );

    const hasVeryFrequentRepair =
      age !== null &&
      age >= 5 &&
      history.repair >= 4 &&
      (
        severeSpecCount >= 1 ||
        hasHdd
      );

    if (
      condition === "rusak" ||
      hasStrongAgeAndRepair ||
      hasRepeatedRepairAndWeakSpec ||
      hasVeryFrequentRepair
    ) {
      category = "replacement";

    } else if (
      condition === "perlu perhatian" ||
      weaknesses.length > 0 ||
      history.repair >= 2
    ) {
      category = "attention";
    }

    if (category === "replacement") {
      reasons.push(...weaknesses);

      if (
        history.repair >= 2 &&
        !reasons.some(reason =>
          reason.includes("kali perbaikan")
        )
      ) {
        reasons.push(
          `Riwayat menunjukkan ${history.repair} kali perbaikan.`
        );
      }

    } else if (category === "attention") {
      reasons.push(...weaknesses);
    }

    return {
      category,
      age,
      history,
      reasons: [...new Set(reasons)]
    };
  }

  // =======================================================
  // PENILAIAN PRINTER
  // =======================================================

  function evaluatePrinter(row) {
    const history = getHistory(
      "printers",
      row.serial
    );

    const age = getPrinterAge(row.ftp);
    const condition = history.latestCondition;

    const reasons = [];

    if (condition === "rusak") {
      reasons.push(
        "Kondisi terakhir pada riwayat Maintenance tercatat Rusak."
      );
    }

    if (condition === "perlu perhatian") {
      reasons.push(
        "Kondisi terakhir tercatat Perlu Perhatian."
      );
    }

    if (age !== null && age >= 8) {
      reasons.push(
        `Masa pakai printer sekitar ${age} tahun.`
      );
    } else if (age !== null && age >= 6) {
      reasons.push(
        `Masa pakai printer sekitar ${age} tahun.`
      );
    }

    if (history.repair >= 4) {
      reasons.push(
        `Sudah tercatat ${history.repair} kali perbaikan.`
      );
    } else if (history.repair >= 2) {
      reasons.push(
        `Sudah tercatat ${history.repair} kali perbaikan.`
      );
    }

    let category = "";

    const oldAndRepeatedRepair =
      age !== null &&
      age >= 8 &&
      history.repair >= 2;

    const olderAndVeryFrequentRepair =
      age !== null &&
      age >= 6 &&
      history.repair >= 4;

    if (
      condition === "rusak" ||
      oldAndRepeatedRepair ||
      olderAndVeryFrequentRepair
    ) {
      category = "replacement";

    } else if (
      condition === "perlu perhatian" ||
      (age !== null && age >= 6) ||
      history.repair >= 2
    ) {
      category = "attention";
    }

    return {
      category,
      age,
      history,
      reasons: [...new Set(reasons)]
    };
  }

  // =======================================================
  // MEMBANGUN DAFTAR REKOMENDASI
  // =======================================================

  function getRecommendations(type) {
    const rows = state[type];

    const evaluated = rows.map(row => {
      const result = type === "computers"
        ? evaluateComputer(row)
        : evaluatePrinter(row);

      return {
        row,
        ...result
      };
    });

    const replacement = evaluated
      .filter(item => item.category === "replacement")
      .sort((a, b) => {
        // Kondisi Rusak mendapat prioritas lebih tinggi.
        const aBroken =
          a.history.latestCondition === "rusak" ? 1 : 0;

        const bBroken =
          b.history.latestCondition === "rusak" ? 1 : 0;

        if (aBroken !== bBroken) {
          return bBroken - aBroken;
        }

        return (
          b.history.repair - a.history.repair ||
          (b.age ?? -1) - (a.age ?? -1)
        );
      });

    const attention = evaluated
      .filter(item => item.category === "attention")
      .sort((a, b) => {
        return (
          b.history.repair - a.history.repair ||
          (b.age ?? -1) - (a.age ?? -1)
        );
      });

    return {
      replacement,
      attention,
      totalReplacement: replacement.length,
      totalAttention: attention.length
    };
  }

  // =======================================================
  // INFORMASI PERANGKAT
  // =======================================================

  function deviceName(row, type) {
    return type === "computers"
      ? row.komputer || row.serial || "Komputer tanpa nama"
      : row.unit || row.model || row.serial || "Printer tanpa nama";
  }

  function deviceSpecification(row, type, age) {
    if (type === "computers") {
      return `
        <div class="evaluation-spec">
          <span>CPU: <strong>${esc(row.cpu || "-")}</strong></span>
          <span>Core / Thread:
            <strong>${esc(row.core || "-")} / ${esc(row.thread || "-")}</strong>
          </span>
          <span>RAM: <strong>${esc(row.ram || "-")}</strong></span>
          <span>Storage: <strong>${esc(row.storage || "-")}</strong></span>
          <span>Usia: <strong>${esc(formatAge(age))}</strong></span>
        </div>
      `;
    }

    return `
      <div class="evaluation-spec">
        <span>Merek: <strong>${esc(row.merek || "-")}</strong></span>
        <span>Model: <strong>${esc(row.model || "-")}</strong></span>
        <span>Tinta: <strong>${esc(row.tinta || "-")}</strong></span>
        <span>Tanggal FTP: <strong>${esc(formatDate(row.ftp))}</strong></span>
        <span>Masa pakai: <strong>${esc(formatAge(age))}</strong></span>
      </div>
    `;
  }

  // =======================================================
  // KARTU REKOMENDASI
  // =======================================================

  function renderDeviceCard(item, type, index, category) {
    const row = item.row;
    const history = item.history;

    const name = deviceName(row, type);

    const isReplacement = category === "replacement";

    const label = isReplacement
      ? "Perlu Penggantian"
      : "Perlu Perhatian";

    const reasons = item.reasons.length
      ? item.reasons
      : ["Terdapat indikator yang perlu diperiksa lebih lanjut."];

    const serialWarning = !serialKey(row.serial)
      ? `
        <p class="evaluation-warning">
          Serial kosong. Riwayat Maintenance tidak dapat dicocokkan.
        </p>
      `
      : "";

    const latestCondition = history.latestCondition
      ? history.latestCondition.replace(/\b\w/g, char =>
          char.toUpperCase()
        )
      : "Belum ada catatan kondisi";

    return `
      <article class="glass-card evaluation-device-card">

        <div class="evaluation-device-heading">

          <div>
            <span class="evaluation-number">
              Prioritas ${index + 1}
            </span>

            <h4>${esc(name)}</h4>

            <small>
              Serial: ${esc(row.serial || "Tidak tersedia")}
            </small>
          </div>

          <span class="evaluation-badge ${isReplacement
            ? "evaluation-red"
            : "evaluation-yellow"}">
            ${label}
          </span>

        </div>

        ${deviceSpecification(row, type, item.age)}

        <div class="evaluation-history">

          <div>
            <span>Perbaikan</span>
            <strong>${history.repair} kali</strong>
          </div>

          <div>
            <span>Perawatan</span>
            <strong>${history.maintenance} kali</strong>
          </div>

          <div>
            <span>Kondisi terakhir</span>
            <strong>${esc(latestCondition)}</strong>
          </div>

          <div>
            <span>Tanggal catatan</span>
            <strong>${history.latestDate
              ? esc(formatDate(history.latestDate))
              : "-"}</strong>
          </div>

        </div>

        <div class="evaluation-reason">

          <strong>Alasan rekomendasi</strong>

          <ul>
            ${reasons.map(reason => `
              <li>${esc(reason)}</li>
            `).join("")}
          </ul>

        </div>

        ${serialWarning}

      </article>
    `;
  }

  // =======================================================
  // BAGIAN KATEGORI
  // =======================================================

  function renderCategory(title, description, items, total, type, category) {
    const isReplacement = category === "replacement";

    const shown = items.slice(0, MAX_PER_CATEGORY);

    return `
      <section class="evaluation-category">

        <div class="evaluation-category-heading">

          <div>
            <h3>
              <span class="evaluation-dot ${isReplacement
                ? "evaluation-dot-red"
                : "evaluation-dot-yellow"}"></span>
              ${title}
            </h3>

            <p>${description}</p>
          </div>

          <span class="evaluation-count">
            ${total} perangkat
          </span>

        </div>

        ${shown.length
          ? shown.map((item, index) =>
              renderDeviceCard(
                item,
                type,
                index,
                category
              )
            ).join("")
          : `
            <div class="glass-card evaluation-empty">
              Tidak ada perangkat yang masuk kategori ini
              berdasarkan data yang tersedia.
            </div>
          `
        }

        ${total > MAX_PER_CATEGORY
          ? `
            <p class="evaluation-limit">
              Menampilkan ${MAX_PER_CATEGORY} perangkat
              dengan prioritas tertinggi dari ${total} perangkat.
            </p>
          `
          : ""
        }

      </section>
    `;
  }

  // =======================================================
  // TAMPILAN UTAMA
  // =======================================================

  function render() {
    const type = state.type;
    const isComputer = type === "computers";

    const recommendations = getRecommendations(type);

    const totalDevices = state[type].length;

    const updated = state.lastUpdated
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(state.lastUpdated)
      : "-";

    root.innerHTML = `
      <div class="inventory-page evaluation-page">

        <div class="inventory-heading">

          <div>
            <span class="inventory-eyebrow">
              GOJAK TECHOPS
            </span>

            <h2>Evaluasi Perangkat</h2>

            <p>
              Rekomendasi perangkat yang membutuhkan
              perhatian atau penggantian.
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
              <h3>Pilih Jenis Perangkat</h3>
              <p>
                Evaluasi komputer dan printer dilakukan
                dengan kriteria masing-masing.
              </p>
            </div>
          </div>

          <div class="maintenance-radio-group">

            <button
              type="button"
              class="inventory-button ${isComputer
                ? "inventory-primary"
                : ""}"
              data-evaluation-type="computers">
              ${icon("komputer")} Komputer
            </button>

            <button
              type="button"
              class="inventory-button ${!isComputer
                ? "inventory-primary"
                : ""}"
              data-evaluation-type="printers">
              ${icon("printer")} Printer
            </button>

          </div>

        </section>

        <div class="dashboard-grid">

          <article class="stat-card">
            <div class="stat-icon blue">
              ${icon(isComputer ? "komputer" : "printer")}
            </div>

            <div class="stat-info">
              <span>Total Perangkat Aktif</span>
              <strong>${totalDevices}</strong>
              <small>${isComputer ? "Komputer" : "Printer"}</small>
            </div>
          </article>

          <article class="stat-card">
            <div class="stat-icon purple">
              ${icon("history")}
            </div>

            <div class="stat-info">
              <span>Perlu Penggantian</span>
              <strong>${recommendations.totalReplacement}</strong>
              <small>Hasil evaluasi</small>
            </div>
          </article>

          <article class="stat-card">
            <div class="stat-icon teal">
              ${icon("monitor")}
            </div>

            <div class="stat-info">
              <span>Perlu Perhatian</span>
              <strong>${recommendations.totalAttention}</strong>
              <small>Hasil evaluasi</small>
            </div>
          </article>

        </div>

        ${renderCategory(
          "Perlu Penggantian",
          "Perangkat dengan indikasi kuat bahwa penggantian perlu diprioritaskan.",
          recommendations.replacement,
          recommendations.totalReplacement,
          type,
          "replacement"
        )}

        ${renderCategory(
          "Perlu Perhatian",
          "Perangkat masih dapat digunakan, tetapi memiliki keterbatasan atau riwayat masalah.",
          recommendations.attention,
          recommendations.totalAttention,
          type,
          "attention"
        )}

        <section class="glass-card evaluation-notes">

          <h3>Dasar Evaluasi</h3>

          <ul>
            <li>
              Kondisi Rusak pada catatan Maintenance terbaru
              menjadi indikasi kuat untuk penggantian.
            </li>

            <li>
              Usia perangkat, spesifikasi, dan frekuensi
              perbaikan dinilai bersama, bukan secara terpisah.
            </li>

            <li>
              Perawatan dihitung dan ditampilkan terpisah.
              Perawatan rutin tidak otomatis dianggap kerusakan.
            </li>

            <li>
              Riwayat Maintenance dicocokkan berdasarkan
              jenis aset dan serial perangkat.
            </li>

            <li>
              Perangkat yang tidak masuk dua kategori
              tidak ditampilkan sebagai rekomendasi.
            </li>

            <li>
              Rekomendasi merupakan hasil penyaringan data
              inventaris dan riwayat yang tercatat.
            </li>
          </ul>

          <div class="inventory-footer">
            Data diperbarui: ${updated}
          </div>

        </section>

      </div>
    `;

    bindEvents();
  }

  // =======================================================
  // EVENT
  // =======================================================

  function bindEvents() {
    $("#evaluationRefresh")?.addEventListener(
      "click",
      () => openPage(true)
    );

    root.querySelectorAll("[data-evaluation-type]")
      .forEach(button => {
        button.addEventListener("click", () => {
          state.type = button.dataset.evaluationType;
          render();
        });
      });
  }

  // =======================================================
  // PESAN
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
  // MEMUAT DATA
  // =======================================================

  async function loadData() {
    if (!isAdmin()) {
      throw new Error(
        "Silakan login sebagai Admin untuk membuka evaluasi perangkat."
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
  // BUKA HALAMAN
  // =======================================================

  async function openPage(forceRefresh = false) {
    if (state.loading) return;

    if (!isAdmin()) {
      state.loaded = false;

      renderMessage(
        "Login Admin diperlukan",
        "Evaluasi membutuhkan serial lengkap untuk mencocokkan riwayat Maintenance. Silakan login Admin terlebih dahulu."
      );

      return;
    }

    if (state.loaded && !forceRefresh) {
      render();
      return;
    }

    state.loading = true;

    renderMessage(
      "Memuat evaluasi perangkat",
      "Sedang membaca inventaris komputer, printer, dan riwayat Maintenance..."
    );

    try {
      await loadData();
      render();

    } catch (error) {
      console.error("Evaluasi perangkat:", error);

      renderMessage(
        "Data belum dapat dimuat",
        error.message || "Periksa koneksi lalu coba kembali."
      );

    } finally {
      state.loading = false;
    }
  }

  // =======================================================
  // NAVIGASI DAN AUTENTIKASI
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
