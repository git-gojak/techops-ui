
document.addEventListener("DOMContentLoaded", () => {
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
    }
  };

  const navButtons = document.querySelectorAll("[data-page]");
  const sections = document.querySelectorAll(".page-section");

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  function navigateTo(page) {
    if (!pageTitles[page]) return;

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

    pageTitle.textContent = pageTitles[page].title;
    pageSubtitle.textContent = pageTitles[page].subtitle;

    sidebar.classList.remove("open");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  // Sidebar mobile
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", event => {
    if (
      window.innerWidth <= 760 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  // Login modal
  const loginModal = document.getElementById("loginModal");
  const profileButton = document.getElementById("profileButton");
  const closeLoginModal = document.getElementById("closeLoginModal");
  const loginButton = document.getElementById("loginButton");
  const adminPin = document.getElementById("adminPin");

  profileButton.addEventListener("click", () => {
    loginModal.classList.add("open");
  });

  closeLoginModal.addEventListener("click", () => {
    loginModal.classList.remove("open");
    adminPin.value = "";
  });

  loginModal.addEventListener("click", event => {
    if (event.target === loginModal) {
      loginModal.classList.remove("open");
      adminPin.value = "";
    }
  });

  // Belum mengirim PIN ke server.
  loginButton.addEventListener("click", () => {
    alert(
      "Autentikasi Admin belum dihubungkan. " +
      "Integrasi akan dilakukan pada tahap berikutnya."
    );
  });

  // Tombol QR sementara
  document.getElementById("mobileQrButton")
    .addEventListener("click", () => {
      alert(
        "Modul QR Scanner akan diintegrasikan pada tahap berikutnya."
      );
    });

  // Fungsi navigasi dapat dipakai modul lain.
  window.TechOps = {
    navigateTo
  };
});
