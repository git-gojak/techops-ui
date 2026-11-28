
/* =========================================================
   GOJAK TECHOPS
   EVALUASI PERANGKAT

   AKSES:
   - Evaluasi Hardware: Publik dan Admin.
   - Evaluasi Perbaikan: Admin saja.
   - Publik menggunakan API getPublic().
   - Admin menggunakan API get().
   - Sensor identitas mengikuti Backend.
   - Read-only, tidak mengubah database.

   FILTER:
   - Dasar evaluasi: Hardware / Riwayat Perbaikan.
   - Jenis perangkat: Semua / Komputer / Printer.
   - Profil: Standar Dasar / Ketat / Ringan.
   - Profil Ketat dan Ringan sementara memakai
     kriteria evaluasi yang berlaku.
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
    view: "hardware",
    type: "all",
    profile: "basic",
    filterOpen: false,
    draft: {
      view: "hardware",
      type: "all",
      profile: "basic"
    },
    loading: false,
    loaded: false,
    lastUpdated: null
  };

  let pageActive = false;

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

  function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function serialKey(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function numberValue(value) {
    const match = String(value ?? "")
      .replace(",", ".")
      .match(/\d+(\.\d+)?/);

    return match ? Number(match[0]) : null;
  }

  // =======================================================
  // TANGGAL
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
      ? "Tidak diketahui"
      : `${age} tahun`;
  }

  // =======================================================
  // IDENTIFIKASI DATA MAINTENANCE
  // =======================================================

  function activityType(row) {
    return normalizeText(
      row?.jenis_kegiatan ||
      row?.kegiatan ||
      ""
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
  // RIWAYAT MAINTENANCE
  // Admin saja. Serial asli hanya digunakan internal.
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

      return (
        (dateB?.getTime() || 0) -
        (dateA?.getTime() || 0)
      );
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
  // PEMERIKSAAN PROCESSOR
  // =======================================================

  function assessCpu(value) {
    const cpu = String(value || "").toUpperCase();

    const intel = cpu.match(
      /\bI[3579]\s*[- ]?\s*(\d{4,5})\b/
    );

    if (intel) {
      const model = intel[1];

      const generation = model.length === 5
        ? Number(model.slice(0, 2))
        : Number(model[0]);

      return {
        known: true,
        meets: generation >= 8,
        generation,
        description: `Intel Core Gen ${generation}`
      };
    }

    const amd = cpu.match(
      /\bRYZEN\s*([3579])\s*(?:PRO\s*)?(\d{4,5})/
    );

    if (amd) {
      const series = Number(amd[1]);
      const model = amd[2];
      const generation = Number(model[0]);

      const meets =
        (series === 3 && generation >= 3) ||
        (series >= 5 && generation >= 2);

      return {
        known: true,
        meets,
        generation,
        description: `AMD Ryzen ${series} seri ${generation}000`
      };
    }

    if (
      /\bCORE\s*ULTRA\b/.test(cpu) ||
      /\bCORE\s*[3579]\s+\d{3,4}[A-Z]?\b/.test(cpu)
    ) {
      return {
        known: true,
        meets: true,
        generation: 99,
        description: "Intel Core generasi baru"
      };
    }

    return {
      known: false,
      meets: false,
      generation: null,
      description: "Model processor belum dikenali"
    };
  }

  // =======================================================
  // EVALUASI HARDWARE KOMPUTER
  // =======================================================

  function evaluateComputerHardware(row) {
    const age = getComputerAge(row.tahun);
    const ram = numberValue(row.ram);
    const core = numberValue(row.core);
    const cpu = assessCpu(row.cpu);

    const replacementFlags = [];
    const attentionFlags = [];

    if (cpu.known && !cpu.meets) {
      replacementFlags.push(
        "Prosesor yang digunakan merupakan generasi lama dan kemampuan pemrosesannya sudah tertinggal."
      );
    } else if (!cpu.known) {
      attentionFlags.push(
        "Model prosesor belum dapat dikenali. Spesifikasi perlu diperiksa kembali."
      );
    }

    if (ram !== null && ram < 8) {
      attentionFlags.push(
        "Kapasitas RAM masih terbatas dan dapat memengaruhi kelancaran penggunaan aplikasi."
      );
    } else if (ram === null) {
      attentionFlags.push(
        "Informasi kapasitas RAM belum tercatat."
      );
    }

    if (core !== null && core < 4) {
      attentionFlags.push(
        "Kemampuan menjalankan beberapa aplikasi secara bersamaan lebih terbatas."
      );
    }

    if (age !== null && age >= 10) {
      attentionFlags.push(
        `Perangkat telah digunakan sekitar ${age} tahun. Perlu dipertimbangkan untuk peremajaan.`
      );
    }

    let category = "";
    let reasons = [];

    if (replacementFlags.length) {
      category = "replacement";
      reasons = [
        ...replacementFlags,
        ...attentionFlags
      ];
    } else if (attentionFlags.length) {
      category = "attention";
      reasons = attentionFlags;
    }

    return {
      category,
      age,
      cpu,
      ram,
      core,
      reasons: [...new Set(reasons)]
    };
  }

  // =======================================================
  // URUTAN PRIORITAS HARDWARE
  // =======================================================

  function sortHardware(a, b) {
    const genA = a.cpu.generation ?? 99;
    const genB = b.cpu.generation ?? 99;

    if (genA !== genB) return genA - genB;

    const coreA = a.core ?? 0;
    const coreB = b.core ?? 0;

    if (coreA !== coreB) return coreA - coreB;

    return (b.age ?? -1) - (a.age ?? -1);
  }

  function getHardwareRecommendations() {
    const evaluated = state.computers.map(row => ({
      row,
      ...evaluateComputerHardware(row)
    }));

    const replacement = evaluated
      .filter(item => item.category === "replacement")
      .sort(sortHardware);

    const attention = evaluated
      .filter(item => item.category === "attention")
      .sort(sortHardware);

    return {
      replacement,
      attention
    };
  }

  // =======================================================
  // EVALUASI BERDASARKAN CATATAN PERBAIKAN
  // =======================================================

  function getRepairRecommendations(type) {
    const rows = state[type];

    const evaluated = rows.map(row => ({
      row,
      history: getHistory(type, row.serial)
    }));

    const withRepair = evaluated
      .filter(item => item.history.repair > 0)
      .sort((a, b) => {
        return (
          b.history.repair - a.history.repair ||
          (b.history.latestDate?.getTime() || 0) -
          (a.history.latestDate?.getTime() || 0)
        );
      });

    const needsReview = evaluated
      .filter(item => {
        return (
          item.history.latestCondition === "rusak" ||
          item.history.latestCondition === "perlu perhatian"
        );
      })
      .sort((a, b) => {
        const rank = value => {
          if (value === "rusak") return 2;
          if (value === "perlu perhatian") return 1;
          return 0;
        };

        return (
          rank(b.history.latestCondition) -
          rank(a.history.latestCondition)
        );
      });

    return {
      withRepair,
      needsReview
    };
  }

  // =======================================================
  // IDENTITAS PERANGKAT
  // =======================================================

  function deviceName(row, type) {
    if (type === "computers") {
      return row.komputer || "Komputer tanpa nama";
    }

    return row.unit || "Unit printer tanpa nama";
  }

  // =======================================================
  // KOMPONEN FIELD SPESIFIKASI
  // =======================================================

  function renderSpecField(name, value, iconName) {
    return `
      <div style="
        display:flex;
        align-items:flex-start;
        gap:8px;
        min-width:0;
        padding:9px 10px;
        border:1px solid var(--border);
        border-radius:10px;
        background:rgba(255,255,255,.025);
      ">
        <span style="flex:0 0 18px;margin-top:1px;">
          ${icon(iconName)}
        </span>

        <div style="min-width:0;flex:1;">
          <small style="
            display:block;
            margin-bottom:3px;
            color:var(--text-muted);
            font-size:10px;
          ">
            ${esc(name)}
          </small>

          <strong style="
            display:block;
            color:var(--text-main);
            font-size:12px;
            font-weight:600;
            line-height:1.5;
            overflow-wrap:anywhere;
            word-break:break-word;
          ">
            ${esc(value || "-")}
          </strong>
        </div>
      </div>
    `;
  }

  // =======================================================
  // SPESIFIKASI KOMPUTER
  // =======================================================

  function computerSpecification(row, age) {
    return `
      <div style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin-top:13px;
      ">
        ${renderSpecField("Processor", row.cpu, "cpu")}

        ${renderSpecField(
          "Core / Thread",
          `${row.core || "-"} / ${row.thread || "-"}`,
          "core"
        )}

        ${renderSpecField("RAM", row.ram, "ram")}
        ${renderSpecField("Storage", row.storage, "storage")}
        ${renderSpecField("Sistem Operasi", row.os, "os")}
        ${renderSpecField("Tahun", row.tahun, "tahun")}

        ${renderSpecField(
          "Usia Perangkat",
          formatAge(age),
          "calendar"
        )}
      </div>
    `;
  }

  // =======================================================
  // SPESIFIKASI PRINTER
  // =======================================================

  function printerSpecification(row) {
    return `
      <div style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin-top:13px;
      ">
        ${renderSpecField("Model", row.model, "model")}
        ${renderSpecField("Merek", row.merek, "merek")}
        ${renderSpecField("Jenis Tinta", row.tinta, "tinta")}
        ${renderSpecField("Tanggal FTP", formatDate(row.ftp), "ftp")}
      </div>
    `;
  }

  // =======================================================
  // TAMPILAN RIWAYAT MAINTENANCE
  // =======================================================

  function renderHistory(history) {
    const condition = history.latestCondition
      ? history.latestCondition.replace(/\b\w/g, char =>
          char.toUpperCase()
        )
      : "Belum ada catatan kondisi";

    return `
      <div class="evaluation-history">
        <div>
          <span>Perbaikan</span>
          <strong>${history.repair} kali tercatat</strong>
        </div>

        <div>
          <span>Perawatan</span>
          <strong>${history.maintenance} kali tercatat</strong>
        </div>

        <div>
          <span>Kondisi terakhir</span>
          <strong>${esc(condition)}</strong>
        </div>

        <div>
          <span>Tanggal catatan terakhir</span>
          <strong>
            ${history.latestDate
              ? esc(formatDate(history.latestDate))
              : "-"}
          </strong>
        </div>
      </div>
    `;
  }

  // =======================================================
  // KARTU HARDWARE KOMPUTER
  // =======================================================

  function renderHardwareCard(item, index, category) {
    const row = item.row;
    const isReplacement = category === "replacement";

    const label = isReplacement
      ? "Perlu Penggantian"
      : "Perlu Perhatian";

    const color = isReplacement
      ? "var(--red)"
      : "var(--yellow)";

    const background = isReplacement
      ? "rgba(240,100,100,.10)"
      : "rgba(242,189,75,.10)";

    return `
      <article
        class="glass-card evaluation-device-card"
        style="min-width:0;overflow:hidden;"
      >
        <div style="
          display:flex;
          flex-direction:column;
          gap:10px;
          min-width:0;
        ">
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            flex-wrap:wrap;
            gap:7px;
          ">
            <span style="
              color:var(--blue-light);
              font-size:11px;
              font-weight:700;
            ">
              PRIORITAS ${index + 1}
            </span>

            <span style="
              display:inline-flex;
              align-items:center;
              justify-content:center;
              gap:6px;
              max-width:100%;
              padding:6px 10px;
              border:1px solid ${color};
              border-radius:20px;
              background:${background};
              color:${color};
              font-size:10px;
              font-weight:700;
              line-height:1.4;
              white-space:normal;
              overflow-wrap:anywhere;
              text-align:center;
            ">
              ${icon(isReplacement ? "history" : "monitor")}
              ${label}
            </span>
          </div>

          <div style="min-width:0;">
            <h4 style="
              margin:0;
              color:var(--text-main);
              font-size:14px;
              line-height:1.5;
              overflow-wrap:anywhere;
            ">
              ${esc(deviceName(row, "computers"))}
            </h4>

            <div style="
              display:flex;
              align-items:flex-start;
              gap:5px;
              margin-top:5px;
              color:var(--green);
              font-size:11px;
              line-height:1.5;
              overflow-wrap:anywhere;
            ">
              ${icon("pengguna")}
              <span style="min-width:0;overflow-wrap:anywhere;">
                ${esc(row.pengguna || "Pengguna belum tercatat")}
              </span>
            </div>

            <small style="
              display:block;
              margin-top:5px;
              color:var(--text-muted);
              font-size:10px;
              overflow-wrap:anywhere;
            ">
              Serial: ${esc(row.serial || "Tidak tersedia")}
            </small>
          </div>
        </div>

        ${computerSpecification(row, item.age)}

        <details class="evaluation-detail" style="margin-top:12px;">
          <summary style="
            padding:10px;
            border:1px solid var(--border);
            border-radius:9px;
            background:rgba(255,255,255,.025);
            color:var(--text-secondary);
            font-size:12px;
            font-weight:600;
            cursor:pointer;
          ">
            Alasan Evaluasi
          </summary>

          <div style="
            padding:10px 4px 2px;
            color:var(--text-secondary);
            font-size:12px;
            line-height:1.7;
          ">
            <ul style="padding-left:18px;margin:0;">
              ${item.reasons.map(reason => `
                <li style="
                  margin-bottom:6px;
                  overflow-wrap:anywhere;
                ">
                  ${esc(reason)}
                </li>
              `).join("")}
            </ul>
          </div>
        </details>
      </article>
    `;
  }

  // =======================================================
  // KARTU PRINTER
  // =======================================================

  function renderPrinterHardwareCard(row, index) {
    return `
      <article
        class="glass-card evaluation-device-card"
        style="min-width:0;overflow:hidden;"
      >
        <div style="
          display:flex;
          align-items:center;
          gap:10px;
          min-width:0;
        ">
          <div class="stat-icon teal" style="flex:0 0 38px;">
            ${icon("printer")}
          </div>

          <div style="min-width:0;flex:1;">
            <small style="
              color:var(--blue-light);
              font-size:10px;
              font-weight:700;
            ">
              PRINTER ${index + 1}
            </small>

            <h4 style="
              margin-top:3px;
              color:var(--text-main);
              font-size:14px;
              line-height:1.5;
              overflow-wrap:anywhere;
            ">
              ${esc(row.unit || "Unit tidak tercatat")}
            </h4>

            <small style="
              display:block;
              margin-top:4px;
              color:var(--text-muted);
              font-size:11px;
              overflow-wrap:anywhere;
            ">
              Model: ${esc(row.model || "Tidak tersedia")}
            </small>

            <small style="
              display:block;
              margin-top:3px;
              color:var(--text-muted);
              font-size:10px;
              overflow-wrap:anywhere;
            ">
              Serial: ${esc(row.serial || "Tidak tersedia")}
            </small>
          </div>
        </div>
      </article>
    `;
  }

  // =======================================================
  // KARTU RIWAYAT PERBAIKAN
  // =======================================================

  function renderRepairCard(item, index, type) {
    const row = item.row;
    const history = item.history;
    const condition = history.latestCondition;

    const needsReview =
      condition === "rusak" ||
      condition === "perlu perhatian";

    const label = needsReview
      ? "Perlu Ditinjau"
      : "Ada Riwayat Perbaikan";

    return `
      <article class="glass-card evaluation-device-card">
        <div class="evaluation-device-heading">
          <div>
            <span class="evaluation-number">
              Data ${index + 1}
            </span>

            <h4>${esc(deviceName(row, type))}</h4>

            <small>
              Serial: ${esc(row.serial || "Tidak tersedia")}
            </small>

            ${type === "computers" ? `
              <small>
                Pengguna: ${esc(row.pengguna || "Tidak tercatat")}
              </small>
            ` : ""}
          </div>

          <span class="evaluation-badge ${
            needsReview ? "evaluation-yellow" : ""
          }">
            ${label}
          </span>
        </div>

        ${type === "computers"
          ? computerSpecification(
              row,
              getComputerAge(row.tahun)
            )
          : printerSpecification(row)
        }

        ${renderHistory(history)}

        ${!serialKey(row.serial) ? `
          <p class="evaluation-warning">
            Serial kosong. Riwayat Maintenance tidak dapat dicocokkan.
          </p>
        ` : ""}
      </article>
    `;
  }

  // =======================================================
  // KATEGORI HARDWARE
  // =======================================================

  function renderHardwareCategory(
    title,
    description,
    items,
    category
  ) {
    const isReplacement = category === "replacement";

    return `
      <section class="evaluation-category">
        <div class="evaluation-category-heading">
          <div>
            <h3>
              <span class="evaluation-dot ${
                isReplacement
                  ? "evaluation-dot-red"
                  : "evaluation-dot-yellow"
              }"></span>
              ${title}
            </h3>
            <p>${description}</p>
          </div>

          <span class="evaluation-count">
            ${items.length} perangkat
          </span>
        </div>

        ${items.length
          ? items.map((item, index) =>
              renderHardwareCard(item, index, category)
            ).join("")
          : `
            <div class="glass-card evaluation-empty">
              Tidak ada perangkat dalam kategori ini.
            </div>
          `
        }
      </section>
    `;
  }

  // =======================================================
  // KATEGORI PRINTER
  // =======================================================

  function renderPrinterHardwarePage() {
    return `
      <section class="evaluation-category">
        <div class="evaluation-category-heading">
          <div>
            <h3>Daftar Printer</h3>
            <p>Identitas printer yang terdaftar dalam inventaris.</p>
          </div>

          <span class="evaluation-count">
            ${state.printers.length} printer
          </span>
        </div>

        ${state.printers.length
          ? state.printers.map((row, index) =>
              renderPrinterHardwareCard(row, index)
            ).join("")
          : `
            <div class="glass-card evaluation-empty">
              Belum ada data printer.
            </div>
          `
        }
      </section>
    `;
  }

  // =======================================================
  // KATEGORI RIWAYAT PERBAIKAN
  // =======================================================

  function renderRepairCategory(
    title,
    description,
    items,
    type
  ) {
    return `
      <section class="evaluation-category">
        <div class="evaluation-category-heading">
          <div>
            <h3>${title}</h3>
            <p>${description}</p>
          </div>

          <span class="evaluation-count">
            ${items.length} perangkat
          </span>
        </div>

        ${items.length
          ? items.map((item, index) =>
              renderRepairCard(item, index, type)
            ).join("")
          : `
            <div class="glass-card evaluation-empty">
              Tidak ada data yang sesuai.
            </div>
          `
        }
      </section>
    `;
  }

  // =======================================================
  // HALAMAN HARDWARE KOMPUTER
  // =======================================================

  function renderComputerHardwarePage() {
    const result = getHardwareRecommendations();

    return `
      <div class="dashboard-grid">
        <article class="stat-card">
          <div class="stat-icon blue">
            ${icon("komputer")}
          </div>

          <div class="stat-info">
            <span>Total Komputer Aktif</span>
            <strong>${state.computers.length}</strong>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon purple">
            ${icon("history")}
          </div>

          <div class="stat-info">
            <span>Perlu Penggantian</span>
            <strong>${result.replacement.length}</strong>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon teal">
            ${icon("monitor")}
          </div>

          <div class="stat-info">
            <span>Perlu Perhatian</span>
            <strong>${result.attention.length}</strong>
          </div>
        </article>
      </div>

      ${renderHardwareCategory(
        "Perlu Penggantian",
        "Perangkat dengan spesifikasi prosesor yang sudah tertinggal dan perlu dipertimbangkan untuk peremajaan.",
        result.replacement,
        "replacement"
      )}

      ${renderHardwareCategory(
        "Perlu Perhatian",
        "Perangkat yang memiliki keterbatasan kapasitas atau perlu dipantau.",
        result.attention,
        "attention"
      )}

      <section class="glass-card evaluation-notes">
        <h3>Dasar Evaluasi Hardware</h3>

        <ul>
          <li>
            Acuan prosesor adalah Intel Core i3 Gen 8
            atau AMD Ryzen 3 seri 3000 dan lebih baru.
          </li>

          <li>
            RAM 8 GB sudah memenuhi kebutuhan dasar.
            RAM di bawah 8 GB perlu diperhatikan.
          </li>

          <li>
            Empat core atau lebih disarankan untuk
            menjalankan beberapa aplikasi bersamaan.
          </li>

          <li>
            SSD SATA dan NVMe sama-sama dapat digunakan.
            HDD tambahan untuk data bukan kekurangan.
          </li>

          <li>
            OS hanya ditampilkan sebagai informasi.
          </li>

          <li>
            Riwayat perbaikan tidak memengaruhi
            penilaian hardware.
          </li>
        </ul>
      </section>
    `;
  }

  // =======================================================
  // HALAMAN RIWAYAT PERBAIKAN
  // =======================================================

  function renderRepairPageForType(type) {
    if (!isAdmin()) {
      return `
        <section class="glass-card">
          <h3>Akses Admin diperlukan</h3>
          <p>Riwayat perbaikan hanya tersedia untuk Admin.</p>
        </section>
      `;
    }

    const isComputer = type === "computers";
    const result = getRepairRecommendations(type);

    const totalRepair = result.withRepair.reduce(
      (total, item) => total + item.history.repair,
      0
    );

    const totalMaintenance = result.withRepair.reduce(
      (total, item) => total + item.history.maintenance,
      0
    );

    return `
      <div class="dashboard-grid">
        <article class="stat-card">
          <div class="stat-icon blue">
            ${icon(isComputer ? "komputer" : "printer")}
          </div>

          <div class="stat-info">
            <span>Perangkat dengan Catatan Perbaikan</span>
            <strong>${result.withRepair.length}</strong>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon purple">
            ${icon("history")}
          </div>

          <div class="stat-info">
            <span>Total Perbaikan Tercatat</span>
            <strong>${totalRepair}</strong>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon teal">
            ${icon("monitor")}
          </div>

          <div class="stat-info">
            <span>Total Perawatan Tercatat</span>
            <strong>${totalMaintenance}</strong>
          </div>
        </article>
      </div>

      ${renderRepairCategory(
        "Kondisi Terakhir Perlu Ditinjau",
        "Perangkat dengan kondisi terakhir Rusak atau Perlu Perhatian.",
        result.needsReview,
        type
      )}

      ${renderRepairCategory(
        "Ada Riwayat Perbaikan",
        "Daftar perangkat yang memiliki catatan Perbaikan pada sistem.",
        result.withRepair,
        type
      )}

      <section class="glass-card evaluation-notes">
        <h3>Catatan Riwayat Maintenance</h3>

        <ul>
          <li>
            Jumlah Perbaikan dan Perawatan dihitung
            secara terpisah.
          </li>

          <li>
            Perawatan rutin tidak dihitung sebagai
            kerusakan atau perbaikan.
          </li>

          <li>
            Riwayat dicocokkan menggunakan jenis aset
            dan serial perangkat.
          </li>

          <li>
            Kondisi terakhir mengikuti catatan Maintenance
            dengan tanggal terbaru yang dapat dibaca.
          </li>

          <li>
            Jumlah yang ditampilkan adalah catatan yang
            tersedia sejak integrasi data Maintenance.
            Angka tersebut bukan jumlah seluruh perbaikan
            sejak perangkat pertama kali digunakan.
          </li>

          <li>
            Tidak adanya catatan perbaikan bukan berarti
            perangkat belum pernah mengalami kerusakan.
          </li>
        </ul>
      </section>
    `;
  }

  // =======================================================
  // PENGGABUNGAN JENIS PERANGKAT
  // =======================================================

  function renderHardwarePage() {
    if (state.type === "printers") {
      return renderPrinterHardwarePage();
    }

    if (state.type === "all") {
      return `
        ${renderComputerHardwarePage()}
        ${renderPrinterHardwarePage()}
      `;
    }

    return renderComputerHardwarePage();
  }

  function renderRepairPage() {
    if (!isAdmin()) {
      return `
        <section class="glass-card">
          <h3>Akses Admin diperlukan</h3>
          <p>Riwayat perbaikan hanya tersedia untuk Admin.</p>
        </section>
      `;
    }

    if (state.type === "all") {
      return `
        ${renderRepairPageForType("computers")}
        ${renderRepairPageForType("printers")}
      `;
    }

    return renderRepairPageForType(state.type);
  }

  // =======================================================
  // PANEL FILTER EVALUASI
  // =======================================================

  function renderFilterPanel() {
    if (!state.filterOpen) return "";

    const selected = (value, current) =>
      value === current ? "inventory-primary" : "";

    const profileDescription = {
      basic: "Menggunakan kriteria evaluasi yang saat ini berlaku.",
      strict: "Profil standar lebih ketat. Ambang penilaian akan ditetapkan pada tahap evaluasi berikutnya.",
      light: "Profil standar lebih ringan. Ambang penilaian akan ditetapkan pada tahap evaluasi berikutnya."
    };

    return `
      <div
        class="evaluation-filter-backdrop"
        data-filter-close="true"
        style="
          position:fixed;
          inset:0;
          z-index:9998;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding:12px;
          background:rgba(0,0,0,.58);
        "
      >
        <section
          class="glass-card evaluation-filter-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evaluationFilterTitle"
          data-filter-panel="true"
          style="
            width:min(100%,620px);
            max-height:88vh;
            overflow:auto;
            padding:18px;
            border:1px solid var(--border);
            border-radius:18px;
            background:var(--card-bg,var(--background));
            box-shadow:0 18px 55px rgba(0,0,0,.32);
          "
        >
          <div style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:12px;
          ">
            <div>
              <h3 id="evaluationFilterTitle" style="margin:0;">
                Filter Evaluasi
              </h3>

              <p style="
                margin:5px 0 0;
                color:var(--text-muted);
                font-size:12px;
              ">
                Tentukan tampilan data sebelum hasil ditampilkan.
              </p>
            </div>

            <button
              type="button"
              class="inventory-button"
              data-filter-close-button
              aria-label="Tutup filter"
            >
              ✕
            </button>
          </div>

          <div style="margin-top:18px;">
            <strong style="
              display:block;
              margin-bottom:9px;
              font-size:13px;
            ">
              Dasar Evaluasi
            </strong>

            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:8px;
            ">
              <button
                type="button"
                class="inventory-button ${selected("hardware", state.draft.view)}"
                data-draft-view="hardware"
              >
                ${icon("monitor")} Hardware
              </button>

              ${isAdmin() ? `
                <button
                  type="button"
                  class="inventory-button ${selected("repair", state.draft.view)}"
                  data-draft-view="repair"
                >
                  ${icon("history")} Riwayat Perbaikan
                </button>
              ` : `
                <button
                  type="button"
                  class="inventory-button"
                  disabled
                  title="Riwayat perbaikan hanya tersedia untuk Admin"
                  style="opacity:.5;cursor:not-allowed;"
                >
                  ${icon("history")} Riwayat Perbaikan (Admin)
                </button>
              `}
            </div>
          </div>

          <div style="margin-top:18px;">
            <strong style="
              display:block;
              margin-bottom:9px;
              font-size:13px;
            ">
              Jenis Perangkat
            </strong>

            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:8px;
            ">
              <button
                type="button"
                class="inventory-button ${selected("all", state.draft.type)}"
                data-draft-type="all"
              >
                Semua
              </button>

              <button
                type="button"
                class="inventory-button ${selected("computers", state.draft.type)}"
                data-draft-type="computers"
              >
                ${icon("komputer")} Komputer
              </button>

              <button
                type="button"
                class="inventory-button ${selected("printers", state.draft.type)}"
                data-draft-type="printers"
              >
                ${icon("printer")} Printer
              </button>
            </div>
          </div>

          <div style="margin-top:18px;">
            <strong style="
              display:block;
              margin-bottom:9px;
              font-size:13px;
            ">
              Profil Standar
            </strong>

            <div style="
              display:grid;
              grid-template-columns:repeat(3,minmax(0,1fr));
              gap:8px;
            ">
              <button
                type="button"
                class="inventory-button ${selected("basic", state.draft.profile)}"
                data-draft-profile="basic"
                style="min-width:0;white-space:normal;"
              >
                Standar Dasar
              </button>

              <button
                type="button"
                class="inventory-button ${selected("strict", state.draft.profile)}"
                data-draft-profile="strict"
                style="min-width:0;white-space:normal;"
              >
                Standar Ketat
              </button>

              <button
                type="button"
                class="inventory-button ${selected("light", state.draft.profile)}"
                data-draft-profile="light"
                style="min-width:0;white-space:normal;"
              >
                Standar Ringan
              </button>
            </div>

            <p style="
              margin:8px 0 0;
              color:var(--text-muted);
              font-size:11px;
              line-height:1.5;
            ">
              ${esc(profileDescription[state.draft.profile] || profileDescription.basic)}
              Hasil evaluasi sementara tetap mengikuti kriteria yang berlaku.
            </p>
          </div>

          <div style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            margin-top:20px;
          ">
            <button
              type="button"
              class="inventory-button"
              data-filter-reset
            >
              Reset
            </button>

            <button
              type="button"
              class="inventory-button inventory-primary"
              data-filter-apply
              style="flex:1 1 160px;"
            >
              Terapkan Filter
            </button>
          </div>
        </section>
      </div>
    `;
  }

  // =======================================================
  // RINGKASAN FILTER AKTIF
  // =======================================================

  function renderFilterSummary() {
    const viewLabel = state.view === "repair"
      ? "Riwayat Perbaikan"
      : "Hardware";

    const typeLabel = {
      all: "Semua Perangkat",
      computers: "Komputer",
      printers: "Printer"
    }[state.type] || "Semua Perangkat";

    const profileLabel = {
      basic: "Standar Dasar",
      strict: "Standar Ketat",
      light: "Standar Ringan"
    }[state.profile] || "Standar Dasar";

    return `
      <section class="glass-card" style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      ">
        <div style="min-width:0;">
          <strong style="
            display:block;
            font-size:13px;
          ">
            Filter aktif
          </strong>

          <span style="
            display:block;
            margin-top:4px;
            color:var(--text-muted);
            font-size:11px;
            line-height:1.5;
          ">
            ${esc(viewLabel)} · ${esc(typeLabel)} · ${esc(profileLabel)}
          </span>
        </div>

        <button
          type="button"
          class="inventory-button"
          id="evaluationFilterOpen"
        >
          ${icon("filter")} Filter
        </button>
      </section>
    `;
  }

  // =======================================================
  // TAMPILAN UTAMA
  // =======================================================

  function render() {
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
              Evaluasi kondisi hardware dan riwayat perbaikan
              perangkat secara terpisah.
            </p>
          </div>

          <button
            type="button"
            class="inventory-button inventory-primary"
            id="evaluationRefresh"
            ${state.loading ? "disabled" : ""}
          >
            ${state.loading ? "Memuat..." : "Perbarui Data"}
          </button>
        </div>

        ${renderFilterSummary()}

        ${renderFilterPanel()}

        ${state.view === "hardware"
          ? renderHardwarePage()
          : renderRepairPage()
        }

        <div class="inventory-footer">
          Data diperbarui: ${esc(updated)}
        </div>
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

    $("#evaluationFilterOpen")?.addEventListener("click", () => {
      state.draft = {
        view: state.view,
        type: state.type,
        profile: state.profile
      };

      state.filterOpen = true;
      render();
    });

    root.querySelectorAll(
      "[data-filter-close], [data-filter-close-button]"
    ).forEach(element => {
      element.addEventListener("click", event => {
        if (event.target.closest("[data-filter-panel]")) return;

        state.filterOpen = false;
        render();
      });
    });

    root.querySelectorAll("[data-draft-view]").forEach(button => {
      button.addEventListener("click", () => {
        if (
          button.dataset.draftView === "repair" &&
          !isAdmin()
        ) {
          return;
        }

        state.draft.view = button.dataset.draftView;
        render();
      });
    });

    root.querySelectorAll("[data-draft-type]").forEach(button => {
      button.addEventListener("click", () => {
        state.draft.type = button.dataset.draftType;
        render();
      });
    });

    root.querySelectorAll("[data-draft-profile]").forEach(button => {
      button.addEventListener("click", () => {
        state.draft.profile = button.dataset.draftProfile;
        render();
      });
    });

    $("[data-filter-reset]")?.addEventListener("click", () => {
      state.draft = {
        view: "hardware",
        type: "all",
        profile: "basic"
      };

      render();
    });

    $("[data-filter-apply]")?.addEventListener("click", () => {
      state.view = isAdmin()
        ? state.draft.view
        : "hardware";

      state.type = state.draft.type;
      state.profile = state.draft.profile;
      state.filterOpen = false;

      render();
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
  //
  // Publik:
  //   getPublic() mengirim sessionId kosong.
  //
  // Admin:
  //   get() menggunakan sesi Admin.
  //
  // Maintenance:
  //   Hanya dimuat untuk Admin.
  // =======================================================

  async function loadData() {
    const api = window.TechOpsAPI;

    if (!api) {
      throw new Error("TechOpsAPI tidak tersedia.");
    }

    const admin = isAdmin();

    const getData = admin
      ? api.get.bind(api)
      : api.getPublic.bind(api);

    const results = await Promise.all([
      getData("computers.list", {
        includeArchived: false
      }),

      getData("printers.list", {
        includeArchived: false
      })
    ]);

    state.computers = normalizeArray(results[0]);
    state.printers = normalizeArray(results[1]);

    if (admin) {
      const maintenance = await api.get("maintenance.list");
      state.maintenance = normalizeArray(maintenance);
    } else {
      state.maintenance = [];
      state.view = "hardware";
    }

    state.lastUpdated = new Date();
    state.loaded = true;
  }

  // =======================================================
  // BUKA HALAMAN
  // =======================================================

  async function openPage(forceRefresh = false) {
    if (state.loading) return;

    if (state.loaded && !forceRefresh) {
      render();
      return;
    }

    state.loading = true;

    renderMessage(
      "Memuat evaluasi perangkat",
      "Sedang membaca data komputer dan printer..."
    );

    let success = false;

    try {
      await loadData();
      success = true;

    } catch (error) {
      console.error("Evaluasi perangkat:", error);

      renderMessage(
        "Data belum dapat dimuat",
        error.message || "Periksa koneksi lalu coba kembali."
      );

    } finally {
      state.loading = false;

      if (success) {
        render();
      }
    }
  }

  // =======================================================
  // NAVIGASI
  // =======================================================

  document.addEventListener(
    "techops:pagechange",
    event => {
      pageActive = event.detail?.page === "connectivity";

      if (pageActive) {
        openPage();
      }
    }
  );

  // =======================================================
  // SINKRONISASI AUTENTIKASI
  // =======================================================

  if (window.TechOpsAPI?.onAuthChange) {
    window.TechOpsAPI.onAuthChange(() => {
      state.loaded = false;

      state.computers = [];
      state.printers = [];
      state.maintenance = [];

      if (!isAdmin()) {
        state.view = "hardware";
      }

      if (pageActive) {
        openPage(true);
      }
    });
  }

  // =======================================================
  // API MODUL
  // =======================================================

  window.EvaluasiPerangkat = {
    openPage,
    refresh: () => openPage(true)
  };

})();
