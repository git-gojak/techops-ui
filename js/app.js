
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const pageTitles = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Ringkasan operasional IT"
    },
    computers: {
      title: "Komputer",
      subtitle: "Inventaris dan spesifikasi komputer"
    },
    printers: {
      title: "Printer",
      subtitle: "Inventaris perangkat printer"
    },
    maintenance: {
      title: "Maintenance",
      subtitle: "Perawatan dan perbaikan perangkat"
    },
    connectivity: {
      title: "Koneksi",
      subtitle: "Monitoring konektivitas"
    },
    guide: {
      title: "Panduan",
      subtitle: "Petunjuk penggunaan GoJak TechOps"
    }
  };

  const navButtons = document.querySelectorAll("[data-page]");
  const sections = document.querySelectorAll(".page-section");

  let activePage = "dashboard";

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mobileQrButton = document.getElementById("mobileQrButton");

  function isAdmin() {
    return window.TechOpsAuth?.authenticated === true;
  }

  function requireAdmin(message = "Fitur ini hanya dapat digunakan Admin.") {
    if (isAdmin()) return true;

    alert(message);
    return false;
  }

  // Tampilkan/sembunyikan elemen khusus Admin.
  function refreshAdminUI() {
    const authenticated = isAdmin();

    document.querySelectorAll("[data-admin-only]").forEach(element => {
      element.hidden = !authenticated;
      element.setAttribute("aria-hidden", String(!authenticated));
    });

    document.querySelectorAll("[data-admin-action]").forEach(element => {
      element.setAttribute(
        "aria-disabled",
        String(!authenticated)
      );
    });

    document.dispatchEvent(
      new CustomEvent("techops:admin-ui-updated", {
        detail: { authenticated }
      })
    );
  }

  function navigateTo(page) {
    if (!pageTitles[page]) return;

    activePage = page;

    sections.forEach(section => {
      section.classList.toggle(
        "active",
        section.id === `page-${page}`
      );
    });

    navButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    if (pageTitle) {
      pageTitle.textContent = pageTitles[page].title;
    }

    if (pageSubtitle) {
      pageSubtitle.textContent = pageTitles[page].subtitle;
    }

    closeSidebar();

    // Beri tahu modul bahwa halaman aktif telah berubah.
    document.dispatchEvent(
      new CustomEvent("techops:pagechange", {
        detail: { page: activePage }
      })
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
    menuToggle?.setAttribute("aria-expanded", "false");
  }

  // Navigasi halaman.
  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  // Sidebar mobile.
  menuToggle?.addEventListener("click", () => {
    const opened = sidebar?.classList.toggle("open");

    sidebarOverlay?.classList.toggle("show", !!opened);
    menuToggle.setAttribute("aria-expanded", String(!!opened));
  });

  sidebarOverlay?.addEventListener("click", closeSidebar);

  document.addEventListener("click", event => {
    if (
      window.innerWidth <= 760 &&
      sidebar?.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !menuToggle?.contains(event.target)
    ) {
      closeSidebar();
    }
  });

  // Pengaman aksi Admin melalui event delegation.
  // Berlaku juga untuk tombol yang dibuat dinamis oleh modul.
  document.addEventListener("click", event => {
    const action = event.target.closest("[data-admin-action]");

    if (!action) return;

    if (!requireAdmin()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("submit", event => {
    const form = event.target.closest("[data-admin-action]");

    if (!form) return;

    if (!requireAdmin()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Tombol QR tengah untuk publik dan Admin.
  mobileQrButton?.addEventListener("click", () => {
    if (window.MaintenancePage?.openScanner) {
      window.MaintenancePage.openScanner();
      return;
    }

    alert("Modul QR belum siap. Silakan muat ulang halaman.");
  });

  // Perbarui tampilan saat status autentikasi berubah.
  document.addEventListener("techops:authchange", refreshAdminUI);

  // API navigasi dan proteksi untuk modul lain.
  window.TechOps = {
    navigateTo,
    getActivePage: () => activePage,
    isAdmin,
    requireAdmin,
    refreshAdminUI
  };

  // Sinkronisasi tampilan awal.
  refreshAdminUI();
});
