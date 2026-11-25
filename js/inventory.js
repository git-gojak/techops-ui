
(function () {
  "use strict";

  const CONFIG = {
    computers: {
      title: "Inventaris Komputer",
      subtitle: "Kelola data dan spesifikasi komputer",
      icon: "monitor",
      action: "computers",
      fields: [
        ["tahun", "Tahun Perolehan", "number"],
        ["komputer", "Computer Name", "text"],
        ["merek", "Manufacturer", "text"],
        ["model", "Model", "text"],
        ["serial", "Asset / Serial ID", "text"],
        ["cpu", "CPU", "text"],
        ["core", "Core", "number"],
        ["thread", "Thread", "number"],
        ["ram", "RAM", "text"],
        ["storage", "Storage", "text"],
        ["gpu", "GPU", "text"],
        ["os", "Operating System", "text"],
        ["pengguna", "Pengguna", "text"]
      ],
      required: ["komputer", "serial"],
      columns: [
        ["komputer", "Computer Name"],
        ["merek", "Manufacturer"],
        ["model", "Model"],
        ["serial", "Serial"],
        ["pengguna", "Pengguna"],
        ["tahun", "Tahun"]
      ]
    },

    printers: {
      title: "Inventaris Printer",
      subtitle: "Kelola data dan informasi operasional printer",
      icon: "printer",
      action: "printers",
      fields: [
        ["serial", "Serial Number", "text"],
        ["unit", "Unit", "text"],
        ["merek", "Merek", "text"],
        ["model", "Model", "text"],
        ["tinta", "Jenis Tinta", "text"],
        ["ftp", "Tanggal FTP", "date"]
      ],
      required: ["serial"],
      columns: [
        ["serial", "Serial Number"],
        ["unit", "Unit"],
        ["merek", "Merek"],
        ["model", "Model"],
        ["tinta", "Jenis Tinta"],
        ["ftp", "Tanggal FTP"],
        ["mp", "Masa Pakai"]
      ]
    }
  };

  const state = {
    computers: [],
    printers: [],
    query: {
      computers: "",
      printers: ""
    },
    page: {
      computers: 1,
      printers: 1
    },
    sort: {
      computers: {
        key: null,
        direction: 0
      },
      printers: {
        key: null,
        direction: 0
      }
    },
    pageSize: 10,
    busy: false,
    requestId: {
      computers: 0,
      printers: 0
    }
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  function normalizeDate(value) {
    if (!value) return "";

    const text = String(value).trim();

    let match = text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }

    match = text.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
    );

    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }

    return "";
  }

  function formatDate(value) {
    const normalized = normalizeDate(value);

    if (!normalized) return value || "-";

    const [year, month, day] =
      normalized.split("-").map(Number);

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(year, month - 1, day));
  }

  function calculateMP(value) {
    const normalized = normalizeDate(value);

    if (!normalized) return "-";

    const [year, month, day] =
      normalized.split("-").map(Number);

    const start = new Date(year, month - 1, day);
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

  function getRows(type) {
    return state[type] || [];
  }

  function getSerial(row) {
    return String(row.serial ?? "");
  }

  function getValue(type, row, key) {
    if (key === "ftp") return formatDate(row.ftp);
    if (key === "mp") return calculateMP(row.ftp);

    return row[key] ?? "-";
  }

  // =======================================================
  // SORTING TABEL
  // =======================================================

  function getSortValue(type, row, key) {
    if (key === "ftp" || key === "mp") {
      const normalized = normalizeDate(row.ftp);

      if (!normalized) return null;

      const [year, month, day] =
        normalized.split("-").map(Number);

      return new Date(
        year,
        month - 1,
        day
      ).getTime();
    }

    const value = row[key];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (key === "tahun") {
      const number = Number(value);

      return Number.isFinite(number)
        ? number
        : null;
    }

    return String(value)
      .trim()
      .toLocaleLowerCase("id-ID");
  }

  function sortRows(type, rows) {
    const sort = state.sort[type];

    if (!sort.key || !sort.direction) {
      return rows;
    }

    return rows
      .map((row, index) => ({
        row,
        index
      }))
      .sort((a, b) => {
        const valueA = getSortValue(
          type,
          a.row,
          sort.key
        );

        const valueB = getSortValue(
          type,
          b.row,
          sort.key
        );

        if (valueA === null && valueB === null) {
          return a.index - b.index;
        }

        if (valueA === null) return 1;
        if (valueB === null) return -1;

        let result;

        if (
          typeof valueA === "number" &&
          typeof valueB === "number"
        ) {
          result = valueA - valueB;
        } else {
          result = String(valueA).localeCompare(
            String(valueB),
            "id",
            {
              numeric: true,
              sensitivity: "base"
            }
          );
        }

        return result === 0
          ? a.index - b.index
          : result * sort.direction;
      })
      .map(item => item.row);
  }

  function toggleSort(type, key) {
    const sort = state.sort[type];

    if (sort.key !== key) {
      sort.key = key;
      sort.direction = 1;

    } else if (sort.direction === 1) {
      sort.direction = -1;

    } else {
      sort.key = null;
      sort.direction = 0;
    }

    state.page[type] = 1;

    drawTable(type);
  }

  function updateSortIndicators(type) {
    const sort = state.sort[type];

    document
      .querySelectorAll(`[data-sort-type="${type}"]`)
      .forEach(header => {
        const key = header.dataset.sortKey;
        const indicator = header.querySelector(
          ".inventory-sort-indicator"
        );

        if (!indicator) return;

        if (sort.key !== key) {
          indicator.textContent = "↕";
        } else {
          indicator.textContent =
            sort.direction === 1 ? "↑" : "↓";
        }
      });
  }

  // =======================================================
  // RENDER HALAMAN
  // =======================================================

  function renderPage(type) {
    const config = CONFIG[type];
    const section = $(`#page-${type}`);

    if (!section) return;

    section.innerHTML = `
      <div class="inventory-page">

        <div class="inventory-heading">
          <button
            class="inventory-button inventory-primary"
            type="button"
            data-add="${type}"
            data-admin-action
            ${isAdmin() ? "" : "hidden"}>
            + Tambah ${type === "computers" ? "Komputer" : "Printer"}
          </button>
        </div>

        <div class="inventory-toolbar">
          <input
            type="search"
            class="inventory-search"
            id="${type}Search"
            placeholder="Cari data inventaris..."
            autocomplete="off">

          <button
            type="button"
            class="inventory-button"
            data-refresh="${type}">
            ↻ Perbarui
          </button>

          <span
            class="inventory-footer"
            id="${type}LoadStatus"
            aria-live="polite"></span>
        </div>

        <div
          class="inventory-summary"
          id="${type}Summary">
          Memuat data...
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-table">

            <thead>
              <tr>
                <th>No.</th>

                ${config.columns.map(([key, label]) => `
                  <th
                    data-sort-type="${type}"
                    data-sort-key="${key}"
                    title="Klik untuk mengurutkan"
                    role="button"
                    tabindex="0"
                    aria-label="Urutkan berdasarkan ${label}">
                    ${label}
                    <span class="inventory-sort-indicator">↕</span>
                  </th>
                `).join("")}

                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody id="${type}TableBody">
              <tr>
                <td colspan="${config.columns.length + 3}">
                  Memuat data...
                </td>
              </tr>
            </tbody>

          </table>
        </div>

        <div class="inventory-footer">
          <span id="${type}PageInfo">-</span>

          <div class="inventory-pagination">

            <select
              data-pagesize="${type}"
              aria-label="Jumlah data per halaman">

              <option value="10">10 data</option>
              <option value="20">20 data</option>
              <option value="50">50 data</option>
              <option value="all">Semua</option>

            </select>

            <button
              class="inventory-button"
              data-prev="${type}">
              ‹
            </button>

            <button
              class="inventory-button"
              data-next="${type}">
              ›
            </button>

          </div>
        </div>

      </div>
    `;

    $(`#${type}Search`).addEventListener(
      "input",
      event => {
        state.query[type] = event.target.value;
        state.page[type] = 1;

        drawTable(type);
      }
    );
  }

  // =======================================================
  // REQUEST API
  // =======================================================

  async function request(type, action, payload = {}) {
    const result = await window.TechOpsAPI.request(
      `${CONFIG[type].action}.${action}`,
      payload
    );

    if (!result || result.success !== true) {
      throw new Error(
        result?.message ||
        "Permintaan gagal diproses."
      );
    }

    return result.data;
  }

  // =======================================================
  // LOAD DATA
  // =======================================================

  async function load(type) {
    const requestId = ++state.requestId[type];

    const body = $(`#${type}TableBody`);
    const status = $(`#${type}LoadStatus`);

    if (!state[type].length && body) {
      body.innerHTML = `
        <tr>
          <td colspan="10">Memuat data...</td>
        </tr>
      `;
    }

    if (status) {
      status.textContent = "Memperbarui data...";
    }

    try {
      const rows = await request(type, "list", {
        includeArchived: isAdmin()
      });

      if (requestId !== state.requestId[type]) {
        return;
      }

      state[type] = Array.isArray(rows)
        ? rows
        : [];

      drawTable(type);

      const currentStatus = $(`#${type}LoadStatus`);

      if (currentStatus) {
        currentStatus.textContent = "Data terbaru";
      }

    } catch (error) {
      if (requestId !== state.requestId[type]) {
        return;
      }

      if (!state[type].length && body) {
        body.innerHTML = `
          <tr>
            <td colspan="10">
              ${escape(error.message)}
            </td>
          </tr>
        `;
      }

      const currentStatus = $(`#${type}LoadStatus`);

      if (currentStatus) {
        currentStatus.textContent = "Pembaruan gagal";
      }

      console.error(
        `Gagal memuat ${type}:`,
        error
      );
    }
  }

  // =======================================================
  // GAMBAR TABEL
  // =======================================================

  function drawTable(type) {
    const config = CONFIG[type];
    const rows = getRows(type);

    const query = state.query[type]
      .toLowerCase()
      .trim();

    const filtered = rows.filter(row => {
      const searchable = config.columns
        .map(([key]) => getValue(type, row, key))
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const sorted = sortRows(type, filtered);

    const activeCount = rows.filter(row =>
      String(row.status || "Aktif").toLowerCase() !== "arsip"
    ).length;

    const archivedCount = rows.length - activeCount;

    const summary = $(`#${type}Summary`);

    if (summary) {
      summary.innerHTML = `
        <span>Total: <strong>${rows.length}</strong></span>
        <span>Aktif: <strong>${activeCount}</strong></span>
        <span>Arsip: <strong>${archivedCount}</strong></span>
        <span>Hasil pencarian: <strong>${filtered.length}</strong></span>
      `;
    }

    const size = state.pageSize === "all"
      ? Math.max(sorted.length, 1)
      : Number(state.pageSize);

    const totalPages = Math.max(
      1,
      Math.ceil(sorted.length / size)
    );

    state.page[type] = Math.min(
      state.page[type],
      totalPages
    );

    const start = (state.page[type] - 1) * size;

    const displayed = sorted.slice(
      start,
      start + size
    );

    const body = $(`#${type}TableBody`);

    if (!body) return;

    if (!displayed.length) {
      body.innerHTML = `
        <tr>
          <td colspan="${config.columns.length + 3}">
            Tidak ada data yang sesuai.
          </td>
        </tr>
      `;

    } else {
      body.innerHTML = displayed.map((row, index) => {
        const archived =
          String(row.status || "").toLowerCase() === "arsip";

        const rowIndex = rows.indexOf(row);

        return `
          <tr>
            <td>${start + index + 1}</td>

            ${config.columns.map(([key]) => `
              <td>${escape(getValue(type, row, key))}</td>
            `).join("")}

            <td>
              <span class="inventory-status ${archived ? "archived" : "active"}">
                ${archived ? "Arsip" : escape(row.status || "Aktif")}
              </span>
            </td>

            <td>
              <div class="inventory-actions">

                <button
                  class="inventory-button"
                  data-detail="${type}"
                  data-index="${rowIndex}">
                  Detail
                </button>

                ${isAdmin() ? archived ? `
                  <button
                    class="inventory-button"
                    data-unarchive="${type}"
                    data-index="${rowIndex}"
                    data-admin-action>
                    Aktifkan
                  </button>
                ` : `
                  <button
                    class="inventory-button"
                    data-edit="${type}"
                    data-index="${rowIndex}"
                    data-admin-action>
                    Edit
                  </button>

                  <button
                    class="inventory-button inventory-danger"
                    data-archive="${type}"
                    data-index="${rowIndex}"
                    data-admin-action>
                    Arsip
                  </button>
                ` : ""}

              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    const info = $(`#${type}PageInfo`);

    if (info) {
      info.textContent = sorted.length
        ? `Menampilkan ${start + 1}–${Math.min(start + displayed.length, sorted.length)} dari ${sorted.length} data`
        : "Tidak ada data";
    }

    const prev = $(`[data-prev="${type}"]`);
    const next = $(`[data-next="${type}"]`);

    if (prev) {
      prev.disabled = state.page[type] <= 1;
    }

    if (next) {
      next.disabled = state.page[type] >= totalPages;
    }

    updateSortIndicators(type);
  }

  // =======================================================
  // MODAL
  // =======================================================

  function openModal(title, content) {
    closeModal();

    const overlay = document.createElement("div");

    overlay.className = "inventory-modal-overlay";

    overlay.innerHTML = `
      <section
        class="inventory-modal"
        role="dialog"
        aria-modal="true">

        <button
          class="inventory-modal-close"
          type="button"
          aria-label="Tutup">
          ×
        </button>

        <h3>${escape(title)}</h3>

        ${content}

      </section>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(
      ".inventory-modal-close"
    ).onclick = closeModal;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    return overlay;
  }

  function closeModal() {
    $(".inventory-modal-overlay")?.remove();
  }

  // =======================================================
  // DETAIL
  // =======================================================

  function showDetail(type, row) {
    const config = CONFIG[type];

    const details = config.fields.map(([key, label]) => `
      <div class="inventory-detail-item">
        <small>${escape(label)}</small>
        <strong>${escape(getValue(type, row, key))}</strong>
      </div>
    `).join("");

    openModal(
      `Detail ${type === "computers" ? "Komputer" : "Printer"}`,
      `<div class="inventory-detail-grid">${details}</div>`
    );
  }

  // =======================================================
  // FORM TAMBAH DAN EDIT
  // =======================================================

  function openForm(type, row = null) {
    if (!isAdmin()) {
      alert("Silakan login sebagai Admin.");
      return;
    }

    const config = CONFIG[type];
    const editing = !!row;

    const fields = config.fields.map(
      ([key, label, inputType]) => {
        let value = row?.[key] ?? "";

        if (key === "ftp") {
          value = normalizeDate(value);
        }

        if (key === "mp") {
          value = calculateMP(row?.ftp);
        }

        const readonly = editing && key === "serial";

        return `
          <label class="inventory-form-field">

            <span>
              ${escape(label)}
              ${config.required.includes(key) ? " *" : ""}
            </span>

            <input
              name="${key}"
              type="${inputType || "text"}"
              value="${escape(value)}"
              ${config.required.includes(key) ? "required" : ""}
              ${readonly ? "readonly" : ""}
              ${inputType === "number" ? 'min="0" step="1"' : ""}
              autocomplete="off">

          </label>
        `;
      }
    ).join("");

    const overlay = openModal(
      editing
        ? `Edit ${type === "computers" ? "Komputer" : "Printer"}`
        : `Tambah ${type === "computers" ? "Komputer" : "Printer"}`,

      `
        <form class="inventory-form">

          <div class="inventory-form-grid">
            ${fields}
          </div>

          <p
            class="inventory-form-message"
            role="alert">
          </p>

          <div class="inventory-form-footer">

            <button
              type="button"
              class="inventory-button"
              data-cancel>
              Batal
            </button>

            <button
              type="submit"
              class="inventory-button inventory-primary">
              ${editing ? "Simpan Perubahan" : "Simpan Data"}
            </button>

          </div>

        </form>
      `
    );

    const form = $(".inventory-form", overlay);
    const message = $(".inventory-form-message", overlay);

    form.elements.ftp?.addEventListener("change", () => {
      // Masa pakai dihitung dari tanggal FTP.
    });

    $("[data-cancel]", overlay).onclick = closeModal;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!isAdmin() || state.busy) return;

      const data = {};

      config.fields.forEach(([key]) => {
        const input = form.elements.namedItem(key);

        if (input) {
          data[key] = String(input.value || "").trim();
        }
      });

      if (type === "printers") {
        data.ftp = normalizeDate(data.ftp);
        data.mp = calculateMP(data.ftp);
      }

      if (editing) {
        data.serial = getSerial(row);
        data.status = row.status || "Aktif";
      } else {
        data.status = "Aktif";
      }

      state.busy = true;

      const button = $('button[type="submit"]', form);

      button.disabled = true;
      button.textContent = "Menyimpan...";

      try {
        await request(
          type,
          editing ? "update" : "create",
          { data }
        );

        closeModal();

        await load(type);

        alert("Data berhasil disimpan.");

      } catch (error) {
        message.textContent =
          error.message || "Gagal menyimpan data.";

        button.disabled = false;
        button.textContent = "Coba Lagi";

      } finally {
        state.busy = false;
      }
    });
  }

  // =======================================================
  // ARSIP DAN AKTIFKAN KEMBALI
  // =======================================================

  async function changeArchive(type, row, action) {
    if (!isAdmin()) return;

    const serial = getSerial(row);

    const label = type === "computers"
      ? "komputer"
      : "printer";

    const question = action === "archive"
      ? `Arsipkan ${label} ini? Data tidak akan dihapus.`
      : `Aktifkan kembali ${label} ini?`;

    if (!confirm(question)) return;

    try {
      await request(type, action, { serial });

      await load(type);

      alert("Status perangkat berhasil diperbarui.");

    } catch (error) {
      alert(
        error.message ||
        "Gagal memperbarui status."
      );
    }
  }

  // =======================================================
  // EVENT KLIK
  // =======================================================

  document.addEventListener("click", event => {
    const sortHeader = event.target.closest(
      "th[data-sort-type]"
    );

    if (sortHeader) {
      toggleSort(
        sortHeader.dataset.sortType,
        sortHeader.dataset.sortKey
      );

      return;
    }

    const button = event.target.closest("button");

    if (!button) return;

    const type =
      button.dataset.add ||
      button.dataset.refresh ||
      button.dataset.detail ||
      button.dataset.edit ||
      button.dataset.archive ||
      button.dataset.unarchive ||
      button.dataset.prev ||
      button.dataset.next ||
      button.dataset.pagesize;

    if (!type) return;

    if (button.dataset.add) {
      if (isAdmin()) {
        openForm(type);
      }

      return;
    }

    if (button.dataset.refresh) {
      load(type);
      return;
    }

    if (button.dataset.prev) {
      state.page[type]--;

      drawTable(type);

      return;
    }

    if (button.dataset.next) {
      state.page[type]++;

      drawTable(type);

      return;
    }

    if (button.dataset.detail) {
      const row = getRows(type)[
        Number(button.dataset.index)
      ];

      if (row) {
        showDetail(type, row);
      }

      return;
    }

    if (button.dataset.edit) {
      if (!isAdmin()) return;

      const row = getRows(type)[
        Number(button.dataset.index)
      ];

      if (row) {
        openForm(type, row);
      }

      return;
    }

    if (
      button.dataset.archive ||
      button.dataset.unarchive
    ) {
      if (!isAdmin()) return;

      const action = button.dataset.archive
        ? "archive"
        : "unarchive";

      const row = getRows(type)[
        Number(button.dataset.index)
      ];

      if (row) {
        changeArchive(type, row, action);
      }
    }
  });

  // Dukungan keyboard untuk header sorting.
  document.addEventListener("keydown", event => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    const header = event.target.closest(
      "th[data-sort-type]"
    );

    if (!header) return;

    event.preventDefault();

    toggleSort(
      header.dataset.sortType,
      header.dataset.sortKey
    );
  });

  // =======================================================
  // JUMLAH DATA PER HALAMAN
  // =======================================================

  document.addEventListener("change", event => {
    const select = event.target.closest(
      "[data-pagesize]"
    );

    if (!select) return;

    state.pageSize = select.value === "all"
      ? "all"
      : Number(select.value);

    state.page.computers = 1;
    state.page.printers = 1;

    drawTable("computers");
    drawTable("printers");
  });

  // =======================================================
  // TOMBOL ADMIN
  // =======================================================

  function refreshAdminButtons() {
    document
      .querySelectorAll("[data-add]")
      .forEach(button => {
        button.hidden = !isAdmin();
      });
  }

  // =======================================================
  // INISIALISASI
  // =======================================================

  function initialize() {
    renderPage("computers");
    renderPage("printers");

    refreshAdminButtons();

    function loadActivePage() {
      const page = window.TechOps?.getActivePage?.();

      if (page === "computers") {
        load("computers");

      } else if (page === "printers") {
        load("printers");
      }
    }

    document.addEventListener(
      "techops:pagechange",
      event => {
        const page = event.detail?.page;

        if (page === "computers") {
          load("computers");

        } else if (page === "printers") {
          load("printers");
        }
      }
    );

    document.addEventListener(
      "techops:authchange",
      () => {
        state.requestId.computers++;
        state.requestId.printers++;

        state.computers = [];
        state.printers = [];

        refreshAdminButtons();

        drawTable("computers");
        drawTable("printers");

        loadActivePage();
      }
    );

    document.addEventListener(
      "techops:admin-ui-updated",
      () => {
        refreshAdminButtons();

        drawTable("computers");
        drawTable("printers");
      }
    );

    loadActivePage();
  }

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

})();
