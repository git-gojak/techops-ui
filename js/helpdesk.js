/**
 * GOJAK TECHOPS — HELPDESK
 * Laporan kendala publik dan Inbox Admin.
 */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const STATUSES = [
    "Baru",
    "Diverifikasi",
    "Diproses",
    "Selesai",
    "Ditolak"
  ];

  let reports = [];
  let loading = false;

  function api() {
    return window.TechOpsAPI;
  }

  function isAdmin() {
    return window.TechOps?.isAdmin?.() === true;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
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

  // =========================================
  // FORM LAPORAN PUBLIK
  // =========================================

  function openReport(device) {
    if (!device || !device.serial) {
      alert("Informasi perangkat tidak lengkap.");
      return;
    }

    $("#maintenanceModal")?.remove();
    document.body.classList.remove("maintenance-modal-open");

    $("#helpdeskModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "helpdeskModal";
    modal.className = "maintenance-modal-backdrop";

    modal.innerHTML = `
      <section class="maintenance-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpdeskModalTitle">

        <header class="maintenance-modal-header">
          <div>
            <small>GOJAK TECHOPS · HELPDESK</small>
            <h2 id="helpdeskModalTitle">Laporkan Kendala</h2>
          </div>

          <button type="button"
            class="maintenance-modal-close"
            id="helpdeskClose">×</button>
        </header>

        <div class="maintenance-modal-body">
          <form id="helpdeskReportForm">

            <div class="maintenance-detail-field">
              <small>Jenis Perangkat</small>
              <strong>${escapeHTML(device.type)}</strong>
            </div>

            <div class="maintenance-detail-field">
              <small>Nama Perangkat</small>
              <strong>${escapeHTML(device.name || device.unit || "-")}</strong>
            </div>

            <div class="maintenance-detail-field">
              <small>Serial</small>
              <strong>${escapeHTML(device.serial)}</strong>
            </div>

            <label for="helpdeskKendala">
              Jelaskan kendala yang dialami
            </label>

            <textarea
              id="helpdeskKendala"
              name="kendala"
              rows="5"
              maxlength="2000"
              required
              minlength="5"
              placeholder="Contoh: Komputer tidak bisa menyala..."
              style="width:100%; margin-top:8px; padding:12px;
                border:1px solid var(--border);
                border-radius:10px;
                background:var(--bg-input);
                color:var(--text-main);
                resize:vertical;"></textarea>

            <div class="maintenance-modal-actions">
              <button type="button"
                class="maintenance-button"
                id="helpdeskCancel">Batal</button>

              <button type="submit"
                class="maintenance-button maintenance-primary"
                id="helpdeskSubmit">
                Kirim Laporan
              </button>
            </div>

            <p id="helpdeskMessage" role="status"></p>
          </form>
        </div>
      </section>
    `;

    document.body.appendChild(modal);
    document.body.classList.add("maintenance-modal-open");

    const close = () => {
      modal.remove();
      document.body.classList.remove("maintenance-modal-open");
    };

    $("#helpdeskClose", modal).addEventListener("click", close);
    $("#helpdeskCancel", modal).addEventListener("click", close);

    $("#helpdeskReportForm", modal).addEventListener("submit", async event => {
      event.preventDefault();

      const button = $("#helpdeskSubmit", modal);
      const message = $("#helpdeskMessage", modal);
      const kendala = $("#helpdeskKendala", modal).value.trim();

      if (kendala.length < 5) {
        message.textContent = "Jelaskan kendala minimal 5 karakter.";
        return;
      }

      button.disabled = true;
      button.textContent = "Mengirim...";
      message.textContent = "";

      try {
        const result = await api().getPublic("helpdesk.submit", {
          perangkat: device.type,
          nama: device.name || device.unit || "-",
          serial: device.serial,
          kendala
        });

        toast(result?.message || "Laporan berhasil dikirim.");
        close();

      } catch (error) {
        message.textContent =
          error.message || "Laporan gagal dikirim.";

        button.disabled = false;
        button.textContent = "Kirim Laporan";
      }
    });
  }

  // =========================================
  // INBOX ADMIN
  // =========================================

  function getRoot() {
    return $("#helpdeskRoot");
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function render() {
    const root = getRoot();
    if (!root) return;

    if (!isAdmin()) {
      root.innerHTML = `
        <div class="empty-state">
          Login Admin diperlukan untuk membuka Helpdesk Inbox.
        </div>
      `;
      return;
    }

    if (loading) {
      root.innerHTML = `<div class="empty-state">Memuat laporan...</div>`;
      return;
    }

    if (!reports.length) {
      root.innerHTML = `
        <div class="empty-state">
          Belum ada laporan kendala.
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="inventory-toolbar">
        <div>
          <strong>${reports.length} Laporan</strong>
          <p>Daftar laporan kendala perangkat</p>
        </div>

        <button type="button"
          class="inventory-button"
          id="helpdeskRefresh">
          Muat Ulang
        </button>
      </div>

      <div class="helpdesk-list">
        ${reports.map(report => `
          <article class="helpdesk-card"
            data-report-id="${escapeHTML(report.id)}">

            <div class="helpdesk-card-heading">
              <div>
                <strong>${escapeHTML(report.nama)}</strong>
                <small>${escapeHTML(report.perangkat)} ·
                  ${escapeHTML(report.serial)}</small>
              </div>

              <span class="inventory-status">
                ${escapeHTML(report.status)}
              </span>
            </div>

            <small>${escapeHTML(formatDate(report.dibuat))}</small>

            <div class="helpdesk-problem">
              ${escapeHTML(report.kendala)}
            </div>

            <label>Status</label>
            <select class="helpdesk-status">
              ${STATUSES.map(status => `
                <option value="${status}"
                  ${status === report.status ? "selected" : ""}>
                  ${status}
                </option>
              `).join("")}
            </select>

            <label>Catatan Admin</label>
            <textarea class="helpdesk-note"
              rows="3"
              maxlength="2000"
              placeholder="Catatan penanganan...">${escapeHTML(report.catatan)}</textarea>

            <button type="button"
              class="inventory-button inventory-primary helpdesk-save">
              Simpan Perubahan
            </button>
          </article>
        `).join("")}
      </div>
    `;

    $("#helpdeskRefresh", root)?.addEventListener("click", loadReports);

    root.querySelectorAll(".helpdesk-save").forEach(button => {
      button.addEventListener("click", saveReport);
    });
  }

  async function loadReports() {
    if (!isAdmin()) {
      render();
      return;
    }

    loading = true;
    render();

    try {
      reports = await api().get("helpdesk.list", {});
      if (!Array.isArray(reports)) reports = [];

    } catch (error) {
      toast(error.message || "Gagal mengambil laporan.");
    } finally {
      loading = false;
      render();
    }
  }

  async function saveReport(event) {
    const card = event.currentTarget.closest("[data-report-id]");
    if (!card || !isAdmin()) return;

    const id = card.dataset.reportId;
    const status = $(".helpdesk-status", card).value;
    const catatan = $(".helpdesk-note", card).value;

    const button = $(".helpdesk-save", card);
    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
      const result = await api().get("helpdesk.update", {
        id,
        status,
        catatan
      });

      toast(result?.message || "Perubahan berhasil disimpan.");
      await loadReports();

    } catch (error) {
      toast(error.message || "Gagal menyimpan perubahan.");
      button.disabled = false;
      button.textContent = "Simpan Perubahan";
    }
  }

  // =========================================
  // EVENT DAN PUBLIC MODULE
  // =========================================

  document.addEventListener("techops:pagechange", event => {
    if (event.detail?.page === "helpdesk") {
      loadReports();
    }
  });

  document.addEventListener("techops:authchange", () => {
    if (window.TechOps?.getActivePage?.() === "helpdesk") {
      loadReports();
    } else {
      render();
    }
  });

  window.HelpdeskPage = {
    openReport,
    loadReports
  };

})();
