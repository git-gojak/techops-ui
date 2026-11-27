(function () {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:47831";

  const POWERSHELL_COMMAND =
    'irm "https://raw.githubusercontent.com/git-gojak/techops-ui/main/log.ps1" | iex';

  const LINUX_COMMAND =
    'bash <(curl -fsSL "https://raw.githubusercontent.com/git-gojak/techops-ui/main/log.sh")';

  const SCAN_FIELDS = [
    ["komputer", "Computer Name", "computerName"],
    ["merek", "Manufacturer", "manufacturer"],
    ["model", "Model", "model"],
    ["serial", "Asset / Serial ID", "assetSerialID"],
    ["cpu", "CPU", "cpu"],
    ["core", "Core", "core"],
    ["thread", "Thread", "thread"],
    ["ram", "RAM", "ram"],
    ["storage", "Storage", "storage"],
    ["gpu", "GPU", "gpu"],
    ["os", "Operating System", "operatingSystem"]
  ];

  const SHEET_FIELDS = [
    "tahun", "komputer", "merek", "model", "serial",
    "cpu", "core", "thread", "ram", "storage", "gpu",
    "os", "pengguna", "scan_terakhir", "perubahan", "status"
  ];

  let currentData = null;
  let currentRecord = null;
  let currentScanId = null;
  let busy = false;

  const $ = (selector, root = document) => root.querySelector(selector);

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalizeSerial(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normalizeValue(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function createScanId() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : "hwscan-" + Date.now() + "-" +
        Math.random().toString(36).slice(2);
  }

  function close() {
    $(".hardware-scan-backdrop")?.remove();
    document.body.classList.remove("maintenance-modal-open");

    currentData = null;
    currentRecord = null;
    currentScanId = null;
    busy = false;
  }

  function getModalBody() {
    return $(".hardware-scan-backdrop .maintenance-modal-body");
  }

  function getMatchingRecord(serial) {
    const rows = window.TechOpsInventory?.getComputers?.() || [];
    const key = normalizeSerial(serial);

    if (!key) return null;

    const matches = rows.filter(row =>
      normalizeSerial(row.serial) === key
    );

    if (matches.length > 1) {
      throw new Error(
        "Serial ditemukan lebih dari satu kali di inventaris. Periksa data komputer terlebih dahulu."
      );
    }

    return matches[0] || null;
  }

  function getChanges(data, pengguna) {
    if (!currentRecord) return [];

    const changes = [];

    SCAN_FIELDS.forEach(([key, label]) => {
      const oldValue = String(currentRecord[key] ?? "").trim();
      const newValue = String(data[key] ?? "").trim();

      if (normalizeValue(oldValue) !== normalizeValue(newValue)) {
        changes.push({
          label,
          oldValue: oldValue || "(kosong)",
          newValue: newValue || "(kosong)"
        });
      }
    });

    const oldUser = String(currentRecord.pengguna ?? "").trim();
    const newUser = String(pengguna ?? "").trim();

    if (normalizeValue(oldUser) !== normalizeValue(newUser)) {
      changes.push({
        label: "Pengguna",
        oldValue: oldUser || "(kosong)",
        newValue: newUser || "(kosong)"
      });
    }

    return changes;
  }

  function renderFields(data, fields) {
    return fields.map(([key, label]) => `
      <div class="maintenance-detail-field">
        <div>
          <small>${esc(label)}</small>
          <strong>${esc(data[key] || "-")}</strong>
        </div>
      </div>
    `).join("");
  }

  function renderChanges(changes) {
    if (!changes.length) {
      return `
        <div class="maintenance-empty">
          Tidak ada perubahan yang terdeteksi.
        </div>
      `;
    }

    return `
      <div class="maintenance-form-grid">
        ${changes.map(change => `
          <div class="inventory-detail-item">
            <small>${esc(change.label)}</small>
            <strong>Sebelum: ${esc(change.oldValue)}</strong>
            <strong>Sesudah: ${esc(change.newValue)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function updateChanges() {
    if (!currentRecord || !currentData) return;

    const pengguna = $("#hwPengguna")?.value.trim() || "";
    const changes = getChanges(currentData, pengguna);
    const preview = $("#hwChangePreview");

    if (preview) {
      preview.innerHTML = renderChanges(changes);
    }

    const count = $("#hwChangeCount");

    if (count) {
      count.textContent = changes.length
        ? `(${changes.length} perubahan)`
        : "(tidak ada perubahan)";
    }
  }

  function renderResults(data, row) {
    currentData = data;
    currentRecord = row;

    const identity = SCAN_FIELDS.slice(0, 4);
    const hardware = SCAN_FIELDS.slice(4);

    const inventorySection = row
      ? `
        <section class="maintenance-form-section">
          <h3>Data Inventaris Saat Ini</h3>

          <div class="maintenance-detail-grid">
            <div class="maintenance-detail-field">
              <div>
                <small>Tahun Perolehan</small>
                <strong>${esc(row.tahun || "-")}</strong>
              </div>
            </div>

            <div class="maintenance-detail-field">
              <div>
                <small>Pengguna Saat Ini</small>
                <strong>${esc(row.pengguna || "-")}</strong>
              </div>
            </div>

            <div class="maintenance-detail-field">
              <div>
                <small>Status</small>
                <strong>${esc(row.status || "-")}</strong>
              </div>
            </div>

            <div class="maintenance-detail-field">
              <div>
                <small>Perubahan Sebelumnya</small>
                <strong>${esc(row.perubahan || "-")}</strong>
              </div>
            </div>
          </div>

          <div class="maintenance-form-grid">
            <label class="maintenance-field">
              <span>Pengguna *</span>
              <input
                id="hwPengguna"
                type="text"
                value="${esc(row.pengguna || "")}"
                placeholder="Masukkan nama pengguna"
                required>
            </label>
          </div>

          <p class="maintenance-form-intro">
            Tahun perolehan dipertahankan. Pengguna dapat diperbarui oleh Admin.
          </p>
        </section>

        <section class="maintenance-form-section">
          <h3>Pemeriksaan Perubahan <span id="hwChangeCount"></span></h3>
          <div id="hwChangePreview"></div>
        </section>
      `
      : `
        <section class="maintenance-form-section">
          <h3>Komputer Baru</h3>

          <div class="maintenance-form-grid">
            <label class="maintenance-field">
              <span>Tahun Perolehan *</span>
              <input
                id="hwTahun"
                type="number"
                min="1900"
                max="2100"
                step="1"
                placeholder="Contoh: 2026"
                required>
            </label>

            <label class="maintenance-field">
              <span>Pengguna *</span>
              <input
                id="hwPengguna"
                type="text"
                placeholder="Masukkan nama pengguna"
                required>
            </label>
          </div>
        </section>
      `;

    return `
      <div class="maintenance-form-section">
        <div class="maintenance-form-message">
          Scan berhasil. ${row
            ? "Komputer ditemukan dalam inventaris."
            : "Komputer belum terdaftar dalam inventaris."}
        </div>
      </div>

      <section class="maintenance-form-section">
        <h3>Identitas Perangkat</h3>
        <div class="maintenance-detail-grid">
          ${renderFields(data, identity)}
        </div>
      </section>

      <section class="maintenance-form-section">
        <h3>Spesifikasi Hardware</h3>
        <div class="maintenance-detail-grid">
          ${renderFields(data, hardware)}
        </div>
      </section>

      <p class="maintenance-form-intro">
        Waktu pemindaian: ${esc(data.scan_terakhir)}
      </p>

      ${inventorySection}

      <div class="maintenance-modal-actions">
        <button type="button" class="maintenance-button" data-hw-close>
          Tutup
        </button>

        <button type="button" class="maintenance-button" data-hw-again>
          Scan Ulang
        </button>

        <button
          type="button"
          class="maintenance-button maintenance-primary"
          id="hwSave">
          ${row ? "Simpan Pembaruan" : "Simpan Komputer Baru"}
        </button>
      </div>
    `;
  }

  function renderError(error) {
    const message = String(error?.message || "Koneksi scanner gagal.");

    return `
      <div class="maintenance-form-section">
        <div class="maintenance-form-message error">
          <strong>Pemindaian belum berhasil.</strong>
          <p>${esc(message)}</p>
          <p>
            Pastikan Hardware Scanner sudah dijalankan pada komputer yang dipindai.
          </p>
        </div>
      </div>

      <section class="maintenance-form-section">
        <h3>Windows — PowerShell</h3>

        <p class="maintenance-form-intro">
          Salin perintah berikut, lalu jalankan di PowerShell komputer yang dipindai.
        </p>

        <div class="inventory-detail-item">
          <code>${esc(POWERSHELL_COMMAND)}</code>
        </div>

        <div class="maintenance-modal-actions">
          <button
            class="maintenance-button maintenance-primary"
            id="hwCopyWindows"
            type="button">
            Salin Perintah Windows
          </button>
        </div>
      </section>

      <section class="maintenance-form-section">
        <h3>Linux — Terminal</h3>

        <p class="maintenance-form-intro">
          Salin perintah berikut, lalu jalankan di Terminal komputer yang dipindai.
        </p>

        <div class="inventory-detail-item">
          <code>${esc(LINUX_COMMAND)}</code>
        </div>

        <div class="maintenance-modal-actions">
          <button
            class="maintenance-button maintenance-primary"
            id="hwCopyLinux"
            type="button">
            Salin Perintah Linux
          </button>
        </div>
      </section>

      <div class="maintenance-modal-actions">
        <button type="button" class="maintenance-button" data-hw-close>
          Tutup
        </button>

        <button
          type="button"
          class="maintenance-button maintenance-primary"
          data-hw-again>
          Coba Lagi
        </button>
      </div>
    `;
  }

  async function copyCommand(command, button) {
    try {
      await navigator.clipboard.writeText(command);
      button.textContent = "Berhasil Disalin";
    } catch (error) {
      alert("Penyalinan otomatis gagal. Silakan salin perintah secara manual.");
    }
  }

  function bindResultActions(body) {
    body.querySelector("[data-hw-close]")
      ?.addEventListener("click", close);

    body.querySelector("[data-hw-again]")
      ?.addEventListener("click", () => runScan(body));

    body.querySelector("#hwSave")
      ?.addEventListener("click", saveResult);

    body.querySelector("#hwPengguna")
      ?.addEventListener("input", updateChanges);

    body.querySelector("#hwCopyWindows")
      ?.addEventListener("click", function () {
        copyCommand(POWERSHELL_COMMAND, this);
      });

    body.querySelector("#hwCopyLinux")
      ?.addEventListener("click", function () {
        copyCommand(LINUX_COMMAND, this);
      });
  }

  async function runScan(body) {
    if (!isAdmin()) {
      body.innerHTML = `
        <div class="maintenance-form-message error">
          Silakan login sebagai Admin untuk menjalankan pemindaian.
        </div>
      `;
      return;
    }

    currentScanId = null;

    body.innerHTML = `
      <div class="maintenance-loading">
        Menghubungi Hardware Scanner dan membaca spesifikasi komputer...
      </div>
    `;

    try {
      const response = await fetch(`${ENDPOINT}/scan`, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit"
      });

      if (!response.ok) {
        throw new Error(`Scanner merespons HTTP ${response.status}.`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "Hasil scan tidak valid.");
      }

      const source = result.data;
      const data = {};

      SCAN_FIELDS.forEach(([key, label, sourceKey]) => {
        data[key] = String(source[sourceKey] ?? "").trim();
      });

      data.scan_terakhir = String(
        source.scannedAt || new Date().toISOString()
      );

      if (!data.serial || data.serial === "-") {
        throw new Error(
          "Serial ID tidak terbaca. Data tidak dapat dicocokkan dengan inventaris."
        );
      }

      await window.TechOpsInventory?.refreshComputers?.();

      const row = getMatchingRecord(data.serial);

      currentScanId = createScanId();
      body.innerHTML = renderResults(data, row);

      bindResultActions(body);

      if (row) updateChanges();

    } catch (error) {
      body.innerHTML = renderError(error);
      bindResultActions(body);
    }
  }

  function buildSaveData() {
    const data = {};

    SHEET_FIELDS.forEach(key => {
      data[key] = "";
    });

    SCAN_FIELDS.forEach(([key]) => {
      data[key] = currentData[key] || "";
    });

    data.scan_terakhir = currentData.scan_terakhir;

    const pengguna = $("#hwPengguna")?.value.trim();

    if (!pengguna) {
      throw new Error("Pengguna wajib diisi.");
    }

    data.pengguna = pengguna;

    if (currentRecord) {
      data.tahun = currentRecord.tahun || "";

      const changes = getChanges(currentData, pengguna);

      data.perubahan = changes.length
        ? changes.map(change =>
            `${change.label}: ${change.oldValue} → ${change.newValue}`
          ).join("; ")
        : currentRecord.perubahan || "";

      const oldStatus = String(currentRecord.status || "").trim();

      if (oldStatus.toLowerCase() === "arsip") {
        data.status = oldStatus;
      } else if (changes.length) {
        data.status = "Ada Perubahan";
      } else {
        data.status = oldStatus || "Aktif";
      }

    } else {
      const year = Number($("#hwTahun")?.value);

      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error("Tahun Perolehan harus diisi dengan benar.");
      }

      data.tahun = String(year);
      data.perubahan = "Komputer baru";
      data.status = "Aktif";
    }

    return data;
  }

  async function saveResult() {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    if (busy || !currentData) return;

    const button = $("#hwSave");
    const isExisting = !!currentRecord;

    try {
      const data = buildSaveData();

      const changes = isExisting
        ? getChanges(currentData, data.pengguna)
        : [];

      const detail = changes.length
        ? "\n\nPerubahan:\n" + changes.map(change =>
            `- ${change.label}: ${change.oldValue} → ${change.newValue}`
          ).join("\n")
        : "";

      const confirmed = confirm(
        isExisting
          ? `Simpan pembaruan komputer ${data.komputer}?${detail}`
          : `Tambahkan komputer ${data.komputer} ke inventaris?`
      );

      if (!confirmed) return;

      if (!currentScanId) {
        throw new Error("ID pemindaian tidak tersedia. Silakan scan ulang.");
      }

      busy = true;

      if (button) {
        button.disabled = true;
        button.textContent = "Menyimpan...";
      }

      const result = await window.TechOpsAPI.request(
        "hardwareScan.save",
        {
          computer: data,
          scanId: currentScanId
        }
      );

      if (!result || result.success !== true) {
        throw new Error(
          result?.message || "Gagal menyimpan data komputer."
        );
      }

      await window.TechOpsInventory?.refreshComputers?.();

      document.dispatchEvent(
        new CustomEvent("techops:hardware-saved")
      );

      const body = getModalBody();

      if (body) {
        body.innerHTML = `
          <div class="maintenance-form-section">
            <div class="maintenance-form-message">
              <strong>
                ${isExisting
                  ? "Pembaruan komputer berhasil disimpan."
                  : "Komputer baru berhasil ditambahkan."}
              </strong>

              <p>${esc(data.komputer)} — ${esc(data.serial)}</p>
              <p>Status: ${esc(data.status)}</p>
              <p>Perubahan: ${esc(data.perubahan || "-")}</p>
              <p>Permintaan penyimpanan berhasil diproses oleh server.</p>
            </div>
          </div>

          <div class="maintenance-modal-actions">
            <button
              type="button"
              class="maintenance-button maintenance-primary"
              data-hw-close>
              Selesai
            </button>
          </div>
        `;

        body.querySelector("[data-hw-close]")
          ?.addEventListener("click", close);
      }

    } catch (error) {
      alert(error.message || "Gagal menyimpan data.");

      if (button) {
        button.disabled = false;
        button.textContent = isExisting
          ? "Simpan Pembaruan"
          : "Simpan Komputer Baru";
      }

    } finally {
      busy = false;
    }
  }

  function open() {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    close();

    const backdrop = document.createElement("div");
    backdrop.className =
      "maintenance-modal-backdrop hardware-scan-backdrop";

    backdrop.innerHTML = `
      <section
        class="maintenance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hardwareScanTitle">

        <header class="maintenance-modal-header">
          <div>
            <small>GOJAK TECHOPS · INVENTARIS KOMPUTER</small>
            <h2 id="hardwareScanTitle">Scan Spesifikasi Komputer</h2>
          </div>

          <button
            class="maintenance-modal-close"
            type="button"
            aria-label="Tutup">
            &times;
          </button>
        </header>

        <div class="maintenance-modal-body">
          <div class="maintenance-loading">
            Menyiapkan pemindaian...
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(backdrop);
    document.body.classList.add("maintenance-modal-open");

    backdrop.querySelector(".maintenance-modal-close")
      .addEventListener("click", close);

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) close();
    });

    runScan(getModalBody());
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-hardware-scan]");

    if (!button) return;

    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    open();
  });

  document.addEventListener("techops:authchange", () => {
    if (!isAdmin()) close();
  });

  window.TechOpsHardware = {
    open,
    close
  };
})();
