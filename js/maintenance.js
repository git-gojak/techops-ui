
/* =========================================================
   GOJAK TECHOPS
   MAINTENANCE MODULE — TECHOPS UI
   Adaptasi dari techops-web/js/maintenance.js
   Backend dan kontrak API tetap menggunakan mekanisme lama.
   ========================================================= */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  let pageSize = 10;
  let selectedDevice = null;
  let qrScanner = null;
  let scannerStarting = false;
  let currentQuery = "";
  let currentPage = 1;
  let lastUpdated = null;
  let initialized = false;
  let dataLoaded = false;
  let loadPromise = null;
   

  // =======================================================
  // UTILITAS
  // =======================================================

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  function escapeHTML(value) {
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

    if (value?.success === false) {
      throw new Error(value.message || "Permintaan API gagal.");
    }

    return [];
  }

  function getValue(obj, keys) {
    if (!obj) return "";

    for (const key of keys) {
      if (
        obj[key] !== undefined &&
        obj[key] !== null &&
        obj[key] !== ""
      ) {
        return String(obj[key]);
      }
    }

    const normalized = {};

    Object.keys(obj).forEach(key => {
      normalized[key.toLowerCase().replace(/[\s_-]/g, "")] =
        obj[key];
    });

    for (const key of keys) {
      const value =
        normalized[key.toLowerCase().replace(/[\s_-]/g, "")];

      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }

    return "";
  }

  function api() {
    return window.TechOpsAPI;
  }

  function getRoot() {
    return $("#maintenanceRoot");
  }

  function iconRefresh() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function toast(message) {
    const region = $("#toastRegion");

    if (!region) {
      alert(message);
      return;
    }

    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;

    region.appendChild(node);
    setTimeout(() => node.remove(), 3500);
  }

  // =======================================================
  // MASKING DATA PUBLIK
  // =======================================================

  function maskSerial(value) {
    const serial = String(value || "").trim();

    if (!serial) return "-";
    if (isAdmin()) return serial;

    if (serial.length <= 4) {
      return "*".repeat(serial.length);
    }

    return "*".repeat(serial.length - 4) +
      serial.slice(-4);
  }

  function maskComputerName(value) {
    const name = String(value || "").trim();

    if (!name) return "-";
    if (isAdmin()) return name;

    if (name.length <= 4) {
      return "*".repeat(name.length);
    }

    return name.slice(0, 2) +
      "*".repeat(name.length - 4) +
      name.slice(-2);
  }

  // =======================================================
  // TANGGAL
  // =======================================================

  function toInputDate(date) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    let year;
    let month;
    let day;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return "-";

      year = value.getFullYear();
      month = value.getMonth() + 1;
      day = value.getDate();

    } else {
      const text = String(value).trim();

      const isoMatch = text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})/
      );

      if (isoMatch) {
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);

      } else {
        const localMatch = text.match(
          /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
        );

        if (!localMatch) return text;

        day = Number(localMatch[1]);
        month = Number(localMatch[2]);
        year = Number(localMatch[3]);
      }
    }

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "-";
    }

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  // =======================================================
  // HALAMAN MAINTENANCE
  // =======================================================

  function render() {
    const root = getRoot();

    if (!root) {
      console.error("Area #maintenanceRoot tidak ditemukan.");
      return;
    }

    const rows = Array.isArray(window.TechOpsMaintenanceData)
      ? window.TechOpsMaintenanceData
      : [];

    root.innerHTML = `
      <div class="inventory-page">

        <div class="inventory-heading">
          <div>
            <span class="inventory-eyebrow">MANAJEMEN PERANGKAT</span>
            <h2>Riwayat Maintenance</h2>
            <p>
              Catatan perawatan dan perbaikan komputer maupun printer.
            </p>
          </div>

          <button
            type="button"
            class="inventory-button"
            id="maintenanceRefresh">
            ↻ Perbarui
          </button>
        </div>

        <div class="inventory-toolbar">
          <input
            type="search"
            id="maintenanceSearch"
            class="inventory-search"
            placeholder="Cari perangkat, serial, kegiatan, teknisi..."
            value="${escapeHTML(currentQuery)}"
            aria-label="Cari riwayat Maintenance"
            autocomplete="off">

        <div class="inventory-summary" id="maintenanceSummary">
          <span>Total riwayat: <strong>${rows.length}</strong></span>
          <span>Hasil pencarian: <strong>—</strong></span>
          <span>Data diperbarui: <strong>Belum tersedia</strong></span>
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Nama Perangkat</th>
                <th>Serial</th>
                <th>Kegiatan</th>
                <th>Keterangan</th>
                <th>Kondisi</th>
                <th>Penanganan</th>
              </tr>
            </thead>

            <tbody id="maintenanceTableBody">
              <tr>
                <td colspan="9">Memuat data Maintenance...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="inventory-footer">
          <span id="maintenancePageInfo">Menyiapkan data...</span>

          <div class="inventory-pagination">
            <select
              id="maintenancePageSize"
              aria-label="Jumlah data per halaman">
              <option value="10" ${pageSize === 10 ? "selected" : ""}>10 data</option>
              <option value="20" ${pageSize === 20 ? "selected" : ""}>20 data</option>
              <option value="50" ${pageSize === 50 ? "selected" : ""}>50 data</option>
              <option value="all" ${pageSize === "all" ? "selected" : ""}>Semua</option>
            </select>

            <button
              type="button"
              class="inventory-button"
              id="maintenancePrev"
              aria-label="Halaman sebelumnya">
              ‹
            </button>

            <button
              type="button"
              class="inventory-button"
              id="maintenanceNext"
              aria-label="Halaman berikutnya">
              ›
            </button>
          </div>
        </div>

      </div>
    `;

    $("#maintenanceRefresh")?.addEventListener("click", refresh);

    $("#maintenanceSearch")?.addEventListener("input", event => {
      currentQuery = event.target.value;
      currentPage = 1;
      drawTable();
    });

    $("#maintenancePageSize")?.addEventListener("change", event => {
      pageSize = event.target.value === "all"
        ? "all"
        : Number(event.target.value);

      currentPage = 1;
      drawTable();
    });

    $("#maintenancePrev")?.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        drawTable();
      }
    });

    $("#maintenanceNext")?.addEventListener("click", () => {
      currentPage++;
      drawTable();
    });

    drawTable();
    iconRefresh();
  }

  // =======================================================
  // TABEL RIWAYAT
  // =======================================================

  function drawTable() {
    const body = $("#maintenanceTableBody");
    if (!body) return;

    const all = Array.isArray(window.TechOpsMaintenanceData)
      ? window.TechOpsMaintenanceData
      : [];

    const query = String(currentQuery || "").toLowerCase().trim();

    const filteredRows = all.filter(row => [
      "Tanggal",
      "jenis_aset",
      "nama_aset",
      "serial",
      "kegiatan",
      "jenis_kegiatan",
      "kondisi",
      "keterangan",
      "teknisi",
      "jadwal"
    ].some(key =>
      String(row[key] ?? "").toLowerCase().includes(query)
    ));

    const size = pageSize === "all"
      ? Math.max(filteredRows.length, 1)
      : pageSize;

    const totalPages = Math.max(
      1,
      Math.ceil(filteredRows.length / size)
    );

    currentPage = Math.min(
      Math.max(currentPage, 1),
      totalPages
    );

    const startIndex = (currentPage - 1) * size;

    const visibleRows = filteredRows.slice(
      startIndex,
      startIndex + size
    );

    const endIndex = startIndex + visibleRows.length;

    const updatedLabel = lastUpdated
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(lastUpdated))
      : "Belum tersedia";

    const summary = $("#maintenanceSummary");

    if (summary) {
      summary.innerHTML = `
        <span>Total riwayat: <strong>${all.length}</strong></span>
        <span>Hasil pencarian: <strong>${filteredRows.length}</strong></span>
        <span>Data diperbarui: <strong>${escapeHTML(updatedLabel)}</strong></span>
      `;
    }

    if (!visibleRows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="9">Tidak ada riwayat Maintenance yang cocok.</td>
        </tr>
      `;
    } else {
      body.innerHTML = visibleRows.map((row, index) => {
        const isPrinter =
          String(row.jenis_aset || "").toLowerCase() === "printer";

        return `
          <tr>
            <td>${startIndex + index + 1}</td>

            <td>${escapeHTML(formatDate(row.Tanggal))}</td>

            <td>${escapeHTML(row.jenis_aset || "-")}</td>

            <td>
              ${escapeHTML(
                isPrinter
                  ? row.nama_aset || "-"
                  : maskComputerName(row.nama_aset)
              )}
            </td>

            <td>${escapeHTML(maskSerial(row.serial))}</td>

            <td>
              ${escapeHTML(
                row.jenis_kegiatan ||
                row.kegiatan ||
                "-"
              )}
            </td>

            <td>${escapeHTML(row.keterangan || "-")}</td>

            <td>${escapeHTML(row.kondisi || "-")}</td>

            <td>${escapeHTML(row.teknisi || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    const pageInfo = $("#maintenancePageInfo");

    if (pageInfo) {
      pageInfo.textContent = filteredRows.length
        ? `Menampilkan ${startIndex + 1}–${endIndex} dari ${filteredRows.length} riwayat`
        : "Tidak ada data";
    }

    const prev = $("#maintenancePrev");
    const next = $("#maintenanceNext");

    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  // =======================================================
  // QR SCANNER
  // =======================================================

  function openScanner() {
    selectedDevice = null;

    const content = `
      <div class="maintenance-scanner-content">

        <p>
          Arahkan kamera belakang HP ke QR Code komputer
          atau printer.
        </p>

        <div
          id="maintenanceQrReader"
          class="maintenance-qr-reader"
        ></div>

        <div
          id="maintenanceScanMessage"
          class="maintenance-scan-message"
        >
          Menyiapkan kamera...
        </div>

      </div>
    `;

    showModal("Scan QR Perangkat", content);

    startScanner();
  }

  async function startScanner() {
    const message = $("#maintenanceScanMessage");

    if (!message) return;

    if (!window.Html5Qrcode) {
      message.textContent =
        "Library QR Scanner tidak ditemukan. Periksa koneksi internet.";
      return;
    }

    if (scannerStarting) return;

    scannerStarting = true;

    try {
      qrScanner = new Html5Qrcode("maintenanceQrReader");

      await qrScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          },
          aspectRatio: 1
        },
        async decodedText => {
          if (!qrScanner) return;

          await stopScanner();

          const currentMessage = $("#maintenanceScanMessage");

          if (currentMessage) {
            currentMessage.textContent =
              "QR terbaca. Memeriksa inventaris...";
          }

          await lookupDevice(decodedText);
        },
        () => {}
      );

      if ($("#maintenanceScanMessage")) {
        message.textContent =
          "Kamera aktif. Silakan scan QR perangkat.";
      }

    } catch (error) {
      console.error("Maintenance QR scanner:", error);

      if ($("#maintenanceScanMessage")) {
        message.textContent =
          "Kamera tidak dapat dibuka. Periksa izin kamera browser.";
      }

    } finally {
      scannerStarting = false;
    }
  }

  async function stopScanner() {
    if (!qrScanner) return;

    const scanner = qrScanner;
    qrScanner = null;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      await scanner.clear();

    } catch (error) {
      console.warn("QR scanner stop:", error);
    }
  }

  // =======================================================
  // PENCARIAN PERANGKAT MELALUI QR INFO
  // =======================================================

  async function lookupDevice(qrText) {
    const message = $("#maintenanceScanMessage");

    try {
      const result = await api().get("qr.info", {
        qr: String(qrText || "").trim()
      });

      if (!result || result.success === false) {
        throw new Error(
          result?.message ||
          "Perangkat tidak ditemukan dalam inventaris."
        );
      }

      const device =
        result.perangkat ||
        result.device ||
        result.data ||
        {};

      if (!Object.keys(device).length) {
        throw new Error("Data perangkat tidak ditemukan.");
      }

      const assetType = String(
        result.jenis_aset || ""
      ).toLowerCase();

      if (
        assetType !== "komputer" &&
        assetType !== "printer"
      ) {
        throw new Error("Jenis perangkat tidak dikenali.");
      }

      const isComputer = assetType === "komputer";

      selectedDevice = {
        type: isComputer ? "Komputer" : "Printer",

        serial: getValue(device, [
          "serial",
          "Asset/Serial ID",
          "Asset Serial ID",
          "asset_id",
          "sn_asset",
          "Serial Number"
        ]),

        name: isComputer
          ? getValue(device, [
              "komputer",
              "Computer Name",
              "computer_name",
              "computerName",
              "nama_aset"
            ])
          : [
              getValue(device, [
                "merek",
                "manufacturer",
                "Manufacturer"
              ]),
              getValue(device, ["model", "Model"])
            ].filter(Boolean).join(" "),

        manufacturer: getValue(device, [
          "merek",
          "manufacturer",
          "Manufacturer"
        ]),

        model: getValue(device, ["model", "Model"]),

        pengguna: getValue(device, [
          "pengguna",
          "Pengguna"
        ]),

        unit: getValue(device, ["unit", "Unit"])
      };

      if (!isAdmin()) {
        showPublicDeviceInfo(result, device, isComputer);
        return;
      }

      if (!selectedDevice.serial) {
        throw new Error("Serial perangkat tidak ditemukan.");
      }

      showDeviceConfirmation();

    } catch (error) {
      console.error("QR lookup:", error);

      if (message) {
        message.innerHTML = `
          <span class="maintenance-error">
            ${escapeHTML(
              error.message || "Gagal memeriksa QR."
            )}
          </span>

          <button
            type="button"
            class="maintenance-button"
            id="maintenanceScanAgain"
          >
            Scan Ulang
          </button>
        `;

        $("#maintenanceScanAgain")
          ?.addEventListener("click", openScanner);
      }
    }
  }

  // =======================================================
  // INFORMASI PERANGKAT UNTUK PUBLIK
  // =======================================================

  function showPublicDeviceInfo(result, device, isComputer) {
    const read = (keys) => {
      const value = getValue(device, keys);
      return value === undefined || value === null || value === ""
        ? "-"
        : String(value);
    };

    const fields = isComputer
      ? [
          ["Tahun Perolehan", ["tahun", "Tahun Perolehan"]],
          ["Computer Name", ["komputer", "Computer Name"]],
          ["Merek", ["merek", "Manufacturer", "manufacturer"]],
          ["Model", ["model", "Model"]],
          ["Serial", ["serial", "Asset/Serial ID", "asset_id"]],
          ["Processor", ["cpu", "CPU"]],
          ["Core", ["core", "Core"]],
          ["Thread", ["thread", "Thread"]],
          ["RAM", ["ram", "RAM"]],
          ["Storage", ["storage", "Storage"]],
          ["GPU", ["gpu", "GPU"]],
          ["Sistem Operasi", ["os", "OS"]],
          ["Pengguna", ["pengguna", "Pengguna"]],
          ["Status", ["status", "Status Perubahan"]]
        ]
      : [
          ["Serial", ["serial", "sn_asset", "Serial Number"]],
          ["Unit", ["unit", "Unit"]],
          ["Merek", ["merek", "Manufacturer", "manufacturer"]],
          ["Model", ["model", "Model"]],
          ["Tinta", ["tinta", "Tinta"]],
          ["FTP", ["ftp", "FTP"]],
          ["MP", ["mp", "MP"]],
          ["Status", ["status", "Status"]]
        ];

    const detailRows = fields.map(([label, keys]) => `
      <div class="maintenance-detail-field">
        <small>${escapeHTML(label)}</small>
        <strong>${escapeHTML(read(keys))}</strong>
      </div>
    `).join("");

    const history = Array.isArray(result.riwayat)
      ? result.riwayat
      : [];

    const historyContent = history.length
      ? history.map(item => `
          <div class="maintenance-detail-field">
            <small>
              ${escapeHTML(String(
                getValue(item, ["Tanggal", "tanggal", "created_at"]) || "-"
              ))}
            </small>
            <strong>
              ${escapeHTML(String(
                getValue(item, ["jenis_kegiatan", "kegiatan", "aktivitas"]) || "-"
              ))}
            </strong>
            <div>
              ${escapeHTML(String(
                getValue(item, ["kondisi", "Kondisi"]) || "-"
              ))}
            </div>
            <div>
              ${escapeHTML(String(
                getValue(item, ["keterangan", "Keterangan", "catatan"]) || "-"
              ))}
            </div>
            <small>
              ${escapeHTML(String(
                getValue(item, ["teknisi", "Teknisi"]) || "-"
              ))}
            </small>
          </div>
        `).join("")
      : `<p>Belum ada riwayat Maintenance.</p>`;

    const content = `
      <div class="maintenance-public-device">

        <h3>Informasi ${isComputer ? "Komputer" : "Printer"}</h3>

        <div class="maintenance-device-details">
          ${detailRows}
        </div>

        <h3>Riwayat Maintenance</h3>

        <div class="maintenance-public-history">
          ${historyContent}
        </div>

        <button
          type="button"
          class="maintenance-button"
          id="maintenanceScanAgain"
        >
          Scan Perangkat Lain
        </button>

      </div>
    `;

    showModal("Informasi Perangkat", content);

    $("#maintenanceScanAgain")
      ?.addEventListener("click", openScanner);
  }

  // =======================================================
  // KONFIRMASI IDENTITAS PERANGKAT
  // =======================================================

  function showDeviceConfirmation() {
    const device = selectedDevice;
    if (!device) return;

    let details = "";

    if (device.type === "Komputer") {
      details = `
        <div class="maintenance-detail-field">
          <small>Serial</small>
          <strong>${escapeHTML(device.serial)}</strong>
        </div>

        <div class="maintenance-detail-field">
          <small>Merek</small>
          <strong>${escapeHTML(device.manufacturer || "-")}</strong>
        </div>

        <div class="maintenance-detail-field">
          <small>Pengguna</small>
          <strong>${escapeHTML(device.pengguna || "-")}</strong>
        </div>
      `;

    } else {
      details = `
        <div class="maintenance-detail-field">
          <small>Unit</small>
          <strong>${escapeHTML(device.unit || "-")}</strong>
        </div>

        <div class="maintenance-detail-field">
          <small>Merek</small>
          <strong>${escapeHTML(device.manufacturer || "-")}</strong>
        </div>

        <div class="maintenance-detail-field">
          <small>Model</small>
          <strong>${escapeHTML(device.model || "-")}</strong>
        </div>
      `;
    }

    const content = `
      <div class="maintenance-confirmation">

        <div class="maintenance-confirmation-heading">
          <span>PERANGKAT DITEMUKAN</span>
          <h3>${escapeHTML(device.type)}</h3>
        </div>

        <div class="maintenance-detail-grid">
          ${details}
        </div>

        <div class="maintenance-modal-actions">

          <button
            type="button"
            class="maintenance-button"
            id="maintenanceRescan"
          >
            Scan Ulang
          </button>

          <button
            type="button"
            class="maintenance-button maintenance-primary"
            id="maintenanceContinue"
          >
            Lanjutkan
          </button>

        </div>

      </div>
    `;

    showModal("Konfirmasi Perangkat", content);

    $("#maintenanceRescan")
      ?.addEventListener("click", openScanner);

    $("#maintenanceContinue")
      ?.addEventListener("click", () => openForm(device));
  }

  // =======================================================
  // FORM MAINTENANCE
  // =======================================================

  function openForm(device) {
    if (!isAdmin() || !device) return;

    selectedDevice = device;

    const dateValue = toInputDate(new Date());

    const content = `
      <form
        id="maintenanceForm"
        class="maintenance-form"
      >

        <div class="maintenance-form-intro">
          Silakan isi detail kegiatan Maintenance.
        </div>

        <section class="maintenance-form-section">

          <div class="maintenance-form-section-title">
            <span>02</span>
            <h3>Detail Maintenance</h3>
          </div>

          <div class="maintenance-form-grid">

            <label class="maintenance-field">
              <span>
                Tanggal <b>*</b>
              </span>

              <input
                id="maintenanceDate"
                type="date"
                value="${dateValue}"
                required
              >
            </label>

            <div class="maintenance-field maintenance-field-wide">
              <span>
                Jenis Kegiatan <b>*</b>
              </span>

              <div class="maintenance-radio-group">
                <label>
                  <input
                    type="radio"
                    name="maintenanceActivity"
                    value="Perawatan"
                    checked
                  >
                  Perawatan
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceActivity"
                    value="Perbaikan"
                  >
                  Perbaikan
                </label>
              </div>
            </div>

            <div
              class="maintenance-field maintenance-field-wide"
              id="maintenanceRepairTypeWrap"
              hidden
            >
              <span>
                Jenis Kerusakan <b>*</b>
              </span>

              <div class="maintenance-radio-group">
                <label>
                  <input
                    type="radio"
                    name="maintenanceRepairType"
                    value="Hardware"
                  >
                  Hardware
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceRepairType"
                    value="Software"
                  >
                  Software
                </label>
              </div>
            </div>

            <label class="maintenance-field maintenance-field-wide">
              <span>
                Keterangan <b>*</b>
              </span>

              <input
                id="maintenanceNotes"
                type="text"
                placeholder="Tuliskan pekerjaan perawatan yang dilakukan"
                required
              >
            </label>

            <div class="maintenance-field maintenance-field-wide">
              <span>
                Kondisi Perangkat <b>*</b>
              </span>

              <div class="maintenance-radio-group">
                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Baik"
                    required
                  >
                  Baik
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Perlu Perhatian"
                    required
                  >
                  Perlu Perhatian
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceCondition"
                    value="Rusak"
                    required
                  >
                  Rusak
                </label>
              </div>
            </div>

            <div class="maintenance-field maintenance-field-wide">
              <span>Refill</span>

              <div class="maintenance-radio-group">
                <label>
                  <input
                    type="radio"
                    name="maintenanceRefill"
                    value="T"
                    checked
                  >
                  Tidak
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceRefill"
                    value="Y"
                  >
                  Ya
                </label>
              </div>
            </div>

          </div>
        </section>

        <section class="maintenance-form-section">

          <div class="maintenance-form-section-title">
            <span>03</span>
            <h3>Penanganan dan Jadwal</h3>
          </div>

          <div class="maintenance-form-grid">

            <div class="maintenance-field maintenance-field-wide">
              <span>Penanganan</span>

              <div class="maintenance-radio-group">
                <label>
                  <input
                    type="radio"
                    name="maintenanceHandler"
                    value="Teknisi"
                    checked
                  >
                  Teknisi
                </label>

                <label>
                  <input
                    type="radio"
                    name="maintenanceHandler"
                    value="Vendor"
                  >
                  Vendor
                </label>
              </div>
            </div>

            <label class="maintenance-field maintenance-field-wide">
              <span>Jadwal Maintenance Berikutnya</span>

              <input
                id="maintenanceSchedule"
                type="date"
                readonly
                placeholder="Dihitung otomatis"
              >

              <small>
                Komputer: 6 bulan. Printer: 3 bulan.
                Perbaikan tidak memiliki jadwal berikutnya.
              </small>
            </label>

          </div>
        </section>

        <div
          id="maintenanceFormMessage"
          class="maintenance-form-message"
          role="alert"
        ></div>

        <div class="maintenance-modal-actions">
          <button
            type="submit"
            class="maintenance-button maintenance-primary"
            id="maintenanceSubmit"
          >
            Simpan Maintenance
          </button>
        </div>

      </form>
    `;

    showModal("Catat Maintenance", content);

    bindFormEvents();
    updateActivityFields();
    updateSchedule();
  }

  // =======================================================
  // MODAL
  // =======================================================

  function showModal(title, content) {
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "maintenance-modal-backdrop";
    backdrop.id = "maintenanceModal";

    backdrop.innerHTML = `
      <section
        class="maintenance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenanceModalTitle"
      >

        <header class="maintenance-modal-header">

          <div>
            <small>GOJAK TECHOPS · ASSET MANAGEMENT</small>
            <h2 id="maintenanceModalTitle">
              ${escapeHTML(title)}
            </h2>
          </div>

          <button
            type="button"
            class="maintenance-modal-close"
            id="maintenanceModalClose"
            aria-label="Tutup"
          >
            ×
          </button>

        </header>

        <div class="maintenance-modal-body">
          ${content}
        </div>

      </section>
    `;

    document.body.appendChild(backdrop);
    document.body.classList.add("maintenance-modal-open");

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    $("#maintenanceModalClose")
      ?.addEventListener("click", closeModal);

    iconRefresh();
  }

  function closeModal() {
    stopScanner();

    $("#maintenanceModal")?.remove();

    document.body.classList.remove(
      "maintenance-modal-open"
    );
  }

  // =======================================================
  // EVENT FORM
  // =======================================================

  function bindFormEvents() {
    const form = $("#maintenanceForm");
    if (!form) return;

    form.querySelectorAll(
      'input[name="maintenanceActivity"], #maintenanceDate'
    ).forEach(input => {
      input.addEventListener("change", () => {
        updateActivityFields();
        updateSchedule();
      });
    });

    form.addEventListener("submit", submitMaintenance);
  }

  // =======================================================
  // JENIS KERUSAKAN
  // =======================================================

  function updateActivityFields() {
    const activity = $(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const wrapper = $("#maintenanceRepairTypeWrap");
    const notes = $("#maintenanceNotes");

    const repairTypes = document.querySelectorAll(
      'input[name="maintenanceRepairType"]'
    );

    if (!wrapper || !notes) return;

    if (activity === "Perbaikan") {
      wrapper.hidden = false;

      repairTypes.forEach(input => {
        input.required = true;
      });

      notes.placeholder =
        "Jelaskan detail kerusakan dan tindakan perbaikan";

    } else {
      wrapper.hidden = true;

      repairTypes.forEach(input => {
        input.required = false;
        input.checked = false;
      });

      notes.placeholder =
        "Tuliskan pekerjaan perawatan yang dilakukan";
    }
  }

  // =======================================================
  // SIMPAN MAINTENANCE
  // =======================================================

  async function submitMaintenance(event) {
    event.preventDefault();

    if (!isAdmin()) {
      showFormMessage(
        "Sesi Admin tidak aktif. Silakan login kembali.",
        true
      );
      return;
    }

    if (!selectedDevice || !selectedDevice.serial) {
      showFormMessage(
        "Perangkat belum teridentifikasi.",
        true
      );
      return;
    }

    const form = $("#maintenanceForm");
    if (!form || !form.reportValidity()) return;

    const activity = form.querySelector(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const condition = form.querySelector(
      'input[name="maintenanceCondition"]:checked'
    )?.value;

    const refill = form.querySelector(
      'input[name="maintenanceRefill"]:checked'
    )?.value || "T";

    const handler = form.querySelector(
      'input[name="maintenanceHandler"]:checked'
    )?.value || "Teknisi";

    const notes = $("#maintenanceNotes")
      ?.value.trim() || "";

    const repairType = form.querySelector(
      'input[name="maintenanceRepairType"]:checked'
    )?.value || "";

    if (!activity || !condition || !notes) {
      showFormMessage(
        "Lengkapi seluruh kolom wajib.",
        true
      );
      return;
    }

    if (
      activity === "Perbaikan" &&
      !repairType
    ) {
      showFormMessage(
        "Pilih jenis kerusakan Hardware atau Software.",
        true
      );
      return;
    }

    const finalNotes = activity === "Perbaikan"
      ? `${repairType} — ${notes}`
      : notes;

    const submitButton = $("#maintenanceSubmit");

    if (
      !api() ||
      typeof api().request !== "function"
    ) {
      showFormMessage(
        "Layanan API belum siap. Muat ulang halaman lalu coba kembali.",
        true
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";

    const payload = {
      jenis_aset: selectedDevice.type,
      serial: selectedDevice.serial,
      Tanggal: $("#maintenanceDate").value,

      jenis_kegiatan: activity,
      kegiatan: activity,
      deskripsi_kegiatan: finalNotes,

      kondisi: condition,
      keterangan: finalNotes,
      refill: refill,
      teknisi: handler

      // Jadwal tidak dikirim dari frontend.
      // Backend tetap menjadi sumber perhitungan jadwal.
    };

    try {
      const response = await api().request(
        "maintenance.create",
        {
          data: payload
        }
      );

      if (response && response.success === false) {
        throw new Error(
          response.message ||
          response.error ||
          "Backend menolak penyimpanan Maintenance."
        );
      }

    } catch (error) {
      console.error("Maintenance create gagal:", error);

      showFormMessage(
        error?.message ||
        "Gagal menyimpan Maintenance. Periksa koneksi dan server.",
        true
      );

      submitButton.disabled = false;
      submitButton.textContent = "Simpan Maintenance";

      return;
    }

    closeModal();

    try {
      await refresh();

    } catch (error) {
      console.warn(
        "Refresh riwayat Maintenance gagal:",
        error
      );
    }

    render();

    // Scanner dibuka kembali untuk perangkat berikutnya.
    openScanner();
  }

  function showFormMessage(message, isError) {
    const target = $("#maintenanceFormMessage");
    if (!target) return;

    target.textContent = message;
    target.classList.toggle("error", !!isError);
  }

  // =======================================================
  // JADWAL MAINTENANCE
  // =======================================================

  function updateSchedule() {
    const activity = $(
      'input[name="maintenanceActivity"]:checked'
    )?.value;

    const dateValue = $("#maintenanceDate")?.value;
    const output = $("#maintenanceSchedule");

    if (!output) return;

    output.value = "";

    if (
      !selectedDevice ||
      activity !== "Perawatan" ||
      !dateValue
    ) {
      return;
    }

    const months = selectedDevice.type === "Komputer"
      ? 6
      : 3;

    output.value = addMonthsClamped(dateValue, months);
  }

  function addMonthsClamped(value, months) {
    const parts = value.split("-").map(Number);

    const year = parts[0];
    const month = parts[1] - 1;
    const day = parts[2];

    const targetMonth = month + months;

    const targetYear =
      year + Math.floor(targetMonth / 12);

    const normalizedMonth = targetMonth % 12;

    const lastDay = new Date(
      targetYear,
      normalizedMonth + 1,
      0
    ).getDate();

    const result = new Date(
      targetYear,
      normalizedMonth,
      Math.min(day, lastDay)
    );

    return toInputDate(result);
  }

  // =======================================================
  // REFRESH DATA
  // =======================================================

  async function refresh() {
    if (!api() || typeof api().get !== "function") {
      throw new Error("TechOpsAPI belum tersedia.");
    }

    const result = await api().get("maintenance.list");

    // Data baru disimpan setelah API berhasil.
    const rows = normalizeArray(result);

    window.TechOpsMaintenanceData = rows;
    lastUpdated = new Date();
    dataLoaded = true;
    currentPage = 1;

    if (getRoot()) {
      render();
    }

    return window.TechOpsMaintenanceData;
  }
     // =======================================================
  // CACHE DAN PENCEGAHAN REQUEST GANDA
  // =======================================================

  async function loadData(forceRefresh = false) {

    // Jika sedang ada request, gunakan proses yang sama.
    if (loadPromise) {
      if (!forceRefresh) {
        return loadPromise;
      }

      // Jika login/logout terjadi saat request lama berjalan,
      // tunggu request lama selesai sebelum mengambil ulang.
      await loadPromise.catch(() => {});

      // Jika request pengganti sudah berjalan, gunakan itu.
      if (loadPromise) {
        return loadPromise;
      }
    }

    // Gunakan cache jika tidak diminta mengambil data baru.
    if (dataLoaded && !forceRefresh) {
      return window.TechOpsMaintenanceData;
    }

    const request = refresh();
    loadPromise = request;

    try {
      return await request;
    } finally {
      if (loadPromise === request) {
        loadPromise = null;
      }
    }
  }

  // =======================================================
  // INISIALISASI DAN NAVIGASI
  // =======================================================

  async function openPage(forceRefresh = false) {
    if (!initialized) {
      initialized = true;

      if (!Array.isArray(window.TechOpsMaintenanceData)) {
        window.TechOpsMaintenanceData = [];
      }
    }

    const root = getRoot();

    // Jika data sudah ada, tampilkan cache tanpa memanggil API.
    if (dataLoaded && !forceRefresh) {
      render();
      return;
    }

    if (root) {
      root.innerHTML = `
        <div class="maintenance-loading">
          Memuat data Maintenance...
        </div>
      `;
    }

    try {
     await loadData(forceRefresh);

    } catch (error) {
      console.error("Maintenance load:", error);

      if (root) {
        root.innerHTML = `
          <div class="maintenance-page">
            <div class="maintenance-empty maintenance-load-error">
              <strong>Data Maintenance belum dapat dimuat.</strong>
              <span>${escapeHTML(error.message || "Periksa koneksi API.")}</span>

              <button
                type="button"
                class="maintenance-button"
                id="maintenanceRetry"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        `;

        $("#maintenanceRetry")
          ?.addEventListener("click", () => openPage(true));
      }
    }
  }

    // =======================================================
  // INISIALISASI — SAMA SEPERTI INVENTARIS
  // =======================================================

  function initialize() {
  if (!Array.isArray(window.TechOpsMaintenanceData)) {
    window.TechOpsMaintenanceData = [];
  }

  // Memuat Maintenance hanya ketika halamannya dibuka.
  document.addEventListener("techops:pagechange", event => {
    if (event.detail?.page === "maintenance") {
      openPage(true);
    }
  });

  // Login/logout hanya memuat ulang Maintenance
  // jika halaman Maintenance sedang aktif.
  document.addEventListener("techops:authchange", () => {
    if (window.TechOps?.getActivePage?.() === "maintenance") {
      openPage(true);
    }
  });
}

document.addEventListener(
  "DOMContentLoaded",
  initialize
);

  // =======================================================
  // PUBLIC MODULE
  // =======================================================

  window.MaintenancePage = {
    render,
    refresh,
    openScanner,
    openPage
  };

})();
