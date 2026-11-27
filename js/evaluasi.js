
/* =========================================================
   GOJAK TECHOPS
   EVALUASI PERANGKAT

   KATEGORI:
   1. Perlu Penggantian
   2. Perlu Perhatian

   STANDAR KOMPUTER:
   - Intel Core i3 Gen 8 atau lebih baru.
   - AMD Ryzen 3 seri 3000 atau lebih baru.
   - RAM minimal 8 GB.
   - 4 core atau lebih disarankan.
   - Core dan thread merupakan faktor pendukung.
   - SSD SATA maupun NVMe memenuhi standar.
   - HDD tambahan untuk data bukan kekurangan.
   - OS hanya ditampilkan sebagai informasi.

   PRINSIP:
   - Hardware menjadi pertimbangan utama.
   - RAM rendah tidak otomatis berarti harus ganti PC.
   - Usia bukan alasan tunggal penggantian.
   - Riwayat perbaikan menjadi faktor pendukung.
   - Perawatan rutin tidak dianggap kerusakan.
   - Riwayat dicocokkan berdasarkan jenis aset dan serial.
   - Semua rekomendasi ditampilkan tanpa batas jumlah.
   - Alasan evaluasi muncul saat kartu dibuka.
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
  // IDENTIFIKASI MAINTENANCE
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
  // RIWAYAT PER PERANGKAT
  // Pencocokan jenis aset dan serial.
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

    // Intel Core i3/i5/i7/i9.
    // Contoh: i3-8100, i5-8500, i3-10100.

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
        description: `Intel Core Gen ${generation}`,
        generation
      };
    }

    // AMD Ryzen.
    // Contoh: Ryzen 3 3200G, Ryzen 5 3600.

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
        description:
          `AMD Ryzen ${series} seri ${generation}000`,
        generation
      };
    }

    // Intel Core Ultra dan penamaan Core baru.

    if (
      /\bCORE\s*ULTRA\b/.test(cpu) ||
      /\bCORE\s*[3579]\s+\d{3,4}[A-Z]?\b/.test(cpu)
    ) {
      return {
        known: true,
        meets: true,
        description: "Intel Core generasi baru",
        generation: null
      };
    }

    return {
      known: false,
      meets: false,
      description: "Model CPU belum dikenali",
      generation: null
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
    const thread = numberValue(row.thread);

    const cpu = assessCpu(row.cpu);
    const condition = history.latestCondition;

    const replacementFlags = [];
    const attentionFlags = [];

    // -----------------------------------------------------
    // HARDWARE: PROCESSOR
    // -----------------------------------------------------

    if (cpu.known && !cpu.meets) {
      replacementFlags.push(
        `Processor ${row.cpu} berada di bawah standar minimal Intel Core i3 Gen 8 atau AMD Ryzen 3 seri 3000.`
      );

    } else if (!cpu.known) {
      attentionFlags.push(
        "Model processor belum dapat dikenali. Spesifikasi perlu diperiksa kembali."
      );
    }

    // -----------------------------------------------------
    // HARDWARE: RAM
    // RAM rendah masih mungkin ditingkatkan.
    // -----------------------------------------------------

    if (ram !== null && ram < 8) {
      attentionFlags.push(
        `RAM hanya ${row.ram || ram + " GB"}. Kapasitas masih di bawah standar 8 GB dan perlu ditingkatkan.`
      );

    } else if (ram === null) {
      attentionFlags.push(
        "Informasi kapasitas RAM belum tercatat."
      );

    } else if (ram === 8) {
      attentionFlags.push(
        "RAM 8 GB memenuhi standar minimal. Peningkatan ke 16 GB dapat dipertimbangkan untuk multitasking."
      );
    }

    // -----------------------------------------------------
    // HARDWARE: CORE DAN THREAD
    // Faktor pendukung, bukan alasan tunggal penggantian.
    // -----------------------------------------------------

    if (core !== null && core < 4) {
      attentionFlags.push(
        `Processor memiliki ${core} core. Empat core atau lebih lebih disarankan untuk multitasking.`
      );
    }

    if (thread !== null && thread < 4) {
      attentionFlags.push(
        `Processor memiliki ${thread} thread. Kemampuan multitasking perlu diperhatikan.`
      );
    }

    // -----------------------------------------------------
    // KONDISI TERAKHIR
    // Rusak tidak otomatis berarti harus mengganti perangkat.
    // Perlu dilihat bersama riwayat perbaikannya.
    // -----------------------------------------------------

    if (condition === "rusak") {
      if (history.repair >= 2) {
        replacementFlags.push(
          `Kondisi terakhir tercatat Rusak dan sudah memiliki ${history.repair} riwayat perbaikan. Penggantian perlu diprioritaskan setelah pemeriksaan teknis.`
        );

      } else {
        attentionFlags.push(
          "Kondisi terakhir pada Maintenance tercatat Rusak. Perlu pemeriksaan teknis untuk menentukan apakah masih layak diperbaiki."
        );
      }

    } else if (condition === "perlu perhatian") {
      attentionFlags.push(
        "Kondisi terakhir pada Maintenance tercatat Perlu Perhatian."
      );
    }

    // -----------------------------------------------------
    // RIWAYAT PERBAIKAN
    // Perawatan tidak masuk hitungan kerusakan.
    // -----------------------------------------------------

    if (history.repair >= 4) {
      if (
        condition === "rusak" ||
        condition === "perlu perhatian"
      ) {
        replacementFlags.push(
          `Sudah tercatat ${history.repair} kali perbaikan. Frekuensi perbaikan bersama kondisi terakhir menjadi pertimbangan kuat penggantian.`
        );

      } else {
        attentionFlags.push(
          `Sudah tercatat ${history.repair} kali perbaikan. Perlu dievaluasi apakah biaya perbaikan berikutnya masih ekonomis.`
        );
      }

    } else if (history.repair >= 2) {
      attentionFlags.push(
        `Sudah tercatat ${history.repair} kali perbaikan. Riwayat ini perlu dipantau.`
      );
    }

    // -----------------------------------------------------
    // USIA PERANGKAT
    // Usia hanya faktor pendukung.
    // -----------------------------------------------------

    if (age !== null && age >= 8) {
      attentionFlags.push(
        `Usia perangkat sekitar ${age} tahun. Perlu dipantau dari sisi keandalan dan kemampuan kerja.`
      );
    }

    // -----------------------------------------------------
    // PENENTUAN KATEGORI
    // -----------------------------------------------------

    let category = "";
    let reasons = [];

    if (replacementFlags.length > 0) {
      category = "replacement";
      reasons = [
        ...replacementFlags,
        ...attentionFlags
      ];

    } else if (attentionFlags.length > 0) {
      category = "attention";
      reasons = attentionFlags;
    }

    return {
      category,
      age,
      history,
      cpu,
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

    const replacementFlags = [];
    const attentionFlags = [];

    // -----------------------------------------------------
    // KONDISI TERAKHIR
    // -----------------------------------------------------

    if (condition === "rusak") {
      if (history.repair >= 2) {
        replacementFlags.push(
          `Kondisi terakhir tercatat Rusak dan sudah memiliki ${history.repair} riwayat perbaikan. Penggantian perlu dipertimbangkan setelah pemeriksaan teknis.`
        );

      } else {
        attentionFlags.push(
          "Kondisi terakhir tercatat Rusak. Perlu pemeriksaan teknis untuk mengetahui apakah printer masih ekonomis diperbaiki."
        );
      }

    } else if (condition === "perlu perhatian") {
      attentionFlags.push(
        "Kondisi terakhir pada Maintenance tercatat Perlu Perhatian."
      );
    }

    // -----------------------------------------------------
    // RIWAYAT PERBAIKAN
    // -----------------------------------------------------

    if (history.repair >= 4) {
      if (
        condition === "rusak" ||
        condition === "perlu perhatian"
      ) {
        replacementFlags.push(
          `Printer telah mengalami ${history.repair} kali perbaikan dan kondisi terakhir memerlukan perhatian. Penggantian perlu dievaluasi.`
        );

      } else {
        attentionFlags.push(
          `Printer telah mengalami ${history.repair} kali perbaikan. Perlu dievaluasi dari sisi biaya dan keandalan.`
        );
      }

    } else if (history.repair >= 2) {
      attentionFlags.push(
        `Sudah tercatat ${history.repair} kali perbaikan. Riwayat ini perlu dipantau.`
      );
    }

    // -----------------------------------------------------
    // MASA PAKAI
    // FTP digunakan sebagai acuan tanggal, bukan bukti
    // pasti tanggal pembelian printer.
    // -----------------------------------------------------

    if (age !== null && age >= 8) {
      attentionFlags.push(
        `Waktu sejak tanggal FTP sekitar ${age} tahun. Perlu dipantau dari sisi keandalan.`
      );

    } else if (age !== null && age >= 6) {
      attentionFlags.push(
        `Waktu sejak tanggal FTP sekitar ${age} tahun.`
      );
    }

    // -----------------------------------------------------
    // PENENTUAN KATEGORI
    // -----------------------------------------------------

    let category = "";
    let reasons = [];

    if (replacementFlags.length > 0) {
      category = "replacement";
      reasons = [
        ...replacementFlags,
        ...attentionFlags
      ];

    } else if (attentionFlags.length > 0) {
      category = "attention";
      reasons = attentionFlags;
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
  // IDENTITAS PERANGKAT
  // =======================================================

  function deviceName(row, type) {
    return type === "computers"
      ? row.komputer || row.serial || "Komputer tanpa nama"
      : row.unit || row.model || row.serial || "Printer tanpa nama";
  }

  // =======================================================
  // SPESIFIKASI PERANGKAT
  // Ditampilkan langsung pada kartu.
  // =======================================================

  function deviceSpecification(row, type, age) {
    if (type === "computers") {
      return `
        <div class="evaluation-spec">

          <span>
            CPU:
            <strong>${esc(row.cpu || "-")}</strong>
          </span>

          <span>
            Core / Thread:
            <strong>${esc(row.core || "-")} / ${esc(row.thread || "-")}</strong>
          </span>

          <span>
            RAM:
            <strong>${esc(row.ram || "-")}</strong>
          </span>

          <span>
            Storage:
            <strong>${esc(row.storage || "-")}</strong>
          </span>

          <span>
            OS:
            <strong>${esc(row.os || "-")}</strong>
          </span>

          <span>
            Tahun:
            <strong>${esc(row.tahun || "-")}</strong>
          </span>

          <span>
            Usia:
            <strong>${esc(formatAge(age))}</strong>
          </span>

        </div>
      `;
    }

    return `
      <div class="evaluation-spec">

        <span>
          Merek:
          <strong>${esc(row.merek || "-")}</strong>
        </span>

        <span>
          Model:
          <strong>${esc(row.model || "-")}</strong>
        </span>

        <span>
          Tinta:
          <strong>${esc(row.tinta || "-")}</strong>
        </span>

        <span>
          Tanggal FTP:
          <strong>${esc(formatDate(row.ftp))}</strong>
        </span>

        <span>
          Masa pakai:
          <strong>${esc(formatAge(age))}</strong>
        </span>

      </div>
    `;
  }

  // =======================================================
  // KARTU PERANGKAT
  // Alasan hanya muncul setelah kartu diklik.
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
      : ["Belum ada alasan evaluasi yang tersedia."];

    const latestCondition = history.latestCondition
      ? history.latestCondition.replace(/\b\w/g, char =>
          char.toUpperCase()
        )
      : "Belum ada catatan kondisi";

    return `
      <details class="glass-card evaluation-device-card">

        <summary class="evaluation-device-heading">

          <div>

            <span class="evaluation-number">
              Prioritas ${index + 1}
            </span>

            <h4>${esc(name)}</h4>

            <small>
              Serial: ${esc(row.serial || "Tidak tersedia")}
            </small>

          </div>

          <span class="evaluation-badge ${
            isReplacement
              ? "evaluation-red"
              : "evaluation-yellow"
          }">
            ${label}
          </span>

        </summary>

        ${deviceSpecification(row, type, item.age)}

        <div class="evaluation-detail">

          <div class="evaluation-reason">

            <strong>Alasan Rekomendasi</strong>

            <ul>
              ${reasons.map(reason => `
                <li>${esc(reason)}</li>
              `).join("")}
            </ul>

          </div>

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
              <strong>
                ${history.latestDate
                  ? esc(formatDate(history.latestDate))
                  : "-"}
              </strong>
            </div>

          </div>

          ${!serialKey(row.serial) ? `
            <p class="evaluation-warning">
              Serial kosong. Riwayat Maintenance tidak dapat dicocokkan.
            </p>
          ` : ""}

        </div>

      </details>
    `;
  }

  // =======================================================
  // BAGIAN KATEGORI
  // Semua perangkat ditampilkan.
  // =======================================================

  function renderCategory(
    title,
    description,
    items,
    total,
    type,
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
            ${total} perangkat
          </span>

        </div>

        ${items.length
          ? items.map((item, index) =>
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
              class="inventory-button ${
                isComputer ? "inventory-primary" : ""
              }"
              data-evaluation-type="computers">

              ${icon("komputer")} Komputer

            </button>

            <button
              type="button"
              class="inventory-button ${
                !isComputer ? "inventory-primary" : ""
              }"
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
          "Perangkat yang masih dapat digunakan, tetapi memiliki keterbatasan atau riwayat masalah.",
          recommendations.attention,
          recommendations.totalAttention,
          type,
          "attention"
        )}

        <section class="glass-card evaluation-notes">

          <h3>Dasar Evaluasi</h3>

          <ul>

            <li>
              Standar minimal komputer adalah Intel Core i3
              Gen 8 atau AMD Ryzen 3 seri 3000, dengan RAM
              minimal 8 GB.
            </li>

            <li>
              RAM yang belum memenuhi standar masih dapat
              dipertimbangkan untuk peningkatan.
            </li>

            <li>
              Empat core atau lebih disarankan untuk
              pekerjaan multitasking. Core dan thread
              menjadi faktor pendukung.
            </li>

            <li>
              SSD SATA dan SSD NVMe sama-sama memenuhi
              standar. NVMe bukan syarat wajib. HDD tambahan
              untuk penyimpanan data tidak menjadi kekurangan.
            </li>

            <li>
              Sistem operasi dan jenis storage ditampilkan
              sebagai informasi, bukan alasan penentuan kategori.
            </li>

            <li>
              Kondisi hardware menjadi pertimbangan utama.
              Riwayat perbaikan digunakan sebagai faktor pendukung.
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
