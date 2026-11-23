
(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const state = {
    user: null,
    authenticated: false,
    checking: true
  };

  const avatar = $("#profileButton");
  const modal = $("#loginModal");
  const loginForm = $("#loginForm");
  const pinInput = $("#adminPin");
  const loginButton = $("#loginButton");
  const loginError = $("#loginError");

  if (
    !avatar ||
    !modal ||
    !loginForm ||
    !pinInput ||
    !loginButton ||
    !window.TechOpsAPI
  ) {
    console.error("Auth gagal diinisialisasi: elemen atau API tidak ditemukan.");
    return;
  }

  // =====================================================
  // UTILITAS
  // =====================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function initials(user) {
    const name = String(
      user?.nama ||
      user?.name ||
      user?.username ||
      "Admin"
    ).trim();

    const words = name.split(/\s+/).filter(Boolean);

    if (words.length > 1) {
      return (
        words[0][0] +
        words[words.length - 1][0]
      ).toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  function notify(message) {
    alert(message);
  }

  function setLoginError(message = "") {
    if (loginError) {
      loginError.textContent = message;
    }
  }

  function dispatchAuthChange() {
    document.dispatchEvent(
      new CustomEvent("techops:authchange", {
        detail: {
          authenticated: state.authenticated,
          user: state.user
        }
      })
    );
  }

  // =====================================================
  // STATUS DAN AVATAR
  // =====================================================

  function updateAvatar() {
    avatar.textContent = state.authenticated
      ? initials(state.user)
      : "GT";

    avatar.title = state.authenticated
      ? "Profil Admin"
      : "Login Admin";

    avatar.setAttribute(
      "aria-label",
      avatar.title
    );

    avatar.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function setAuthenticated(authenticated, user = null) {
    state.authenticated = authenticated;
    state.user = authenticated
      ? (user || state.user || {
          nama: "Admin",
          role: "Admin"
        })
      : null;

    updateAvatar();

    if (!authenticated) {
      closeDynamicModal();
      closeLogin();
    }

    dispatchAuthChange();
  }

  // =====================================================
  // MODAL LOGIN
  // =====================================================

  function closeLogin() {
    modal.classList.remove("open");
    pinInput.value = "";
    setLoginError("");
  }

  function openLogin() {
    if (state.checking) {
      notify("Sedang memeriksa sesi Admin. Silakan tunggu.");
      return;
    }

    setLoginError("");
    modal.classList.add("open");
    pinInput.focus();
  }

  // =====================================================
  // MODAL DINAMIS
  // =====================================================

  function closeDynamicModal() {
    document.querySelectorAll(
      "#techOpsProfileMenu, #techOpsProfileModal, #techOpsChangePinModal"
    ).forEach(element => element.remove());
  }

  function showProfile() {
    closeDynamicModal();

    const user = state.user || {};

    const fields = [
      ["Nama", user.nama || user.name],
      ["Username", user.username || user.userName],
      ["Email", user.email],
      ["Role", user.role || "Admin"]
    ].filter(([, value]) => value);

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "techOpsProfileModal";

    overlay.innerHTML = `
      <section class="modal-card">
        <button class="modal-close" type="button"
          aria-label="Tutup">×</button>

        <div class="modal-logo">${escapeHTML(initials(user))}</div>

        <h2>Profil Admin</h2>

        <p class="modal-description">
          Informasi akun yang sedang digunakan
        </p>

        <div class="profile-details">
          ${fields.map(([label, value]) => `
            <div class="profile-detail">
              <small>${escapeHTML(label)}</small>
              <strong>${escapeHTML(value)}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".modal-close")
      .addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });
  }

  function profileMenu() {
    closeDynamicModal();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "techOpsProfileMenu";

    overlay.innerHTML = `
      <section class="modal-card profile-menu-card">
        <button class="modal-close" type="button"
          aria-label="Tutup">×</button>

        <div class="modal-logo">
          ${escapeHTML(initials(state.user))}
        </div>

        <h2>Admin</h2>

        <p class="modal-description">
          Pengelolaan akun
        </p>

        <button class="profile-action" data-action="profile">
          Profil Admin
        </button>

        <button class="profile-action" data-action="pin">
          Ganti PIN
        </button>

        <button class="profile-action danger" data-action="logout">
          Keluar
        </button>
      </section>
    `;

    document.body.appendChild(overlay);

    avatar.setAttribute("aria-expanded", "true");

    overlay.querySelector(".modal-close")
      .addEventListener("click", () => {
        overlay.remove();
        avatar.setAttribute("aria-expanded", "false");
      });

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
        avatar.setAttribute("aria-expanded", "false");
      }
    });

    overlay.querySelectorAll("[data-action]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const action = button.dataset.action;

          overlay.remove();
          avatar.setAttribute("aria-expanded", "false");

          if (action === "profile") showProfile();
          if (action === "pin") showChangePin();
          if (action === "logout") logout();
        });
      });
  }

  // =====================================================
  // GANTI PIN
  // =====================================================

  function showChangePin() {
    closeDynamicModal();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "techOpsChangePinModal";

    overlay.innerHTML = `
      <section class="modal-card">
        <button class="modal-close" type="button"
          aria-label="Tutup">×</button>

        <div class="modal-logo">GT</div>

        <h2>Ganti PIN Admin</h2>

        <p class="modal-description">
          Masukkan PIN lama dan PIN baru.
        </p>

        <form id="changePinForm">
          <label for="oldPin">PIN Lama</label>
          <input id="oldPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" autocomplete="current-password"
            required>

          <label for="newPin">PIN Baru</label>
          <input id="newPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" autocomplete="new-password"
            required>

          <label for="confirmPin">Konfirmasi PIN Baru</label>
          <input id="confirmPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" autocomplete="new-password"
            required>

          <p id="changePinError" class="auth-error"
            role="alert" aria-live="polite"></p>

          <button class="primary-button" type="submit">
            Simpan PIN Baru
          </button>
        </form>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".modal-close")
      .addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    $("#changePinForm", overlay)
      .addEventListener("submit", handleChangePin);
  }

  async function handleChangePin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const oldPin = $("#oldPin", form).value;
    const newPin = $("#newPin", form).value;
    const confirmPin = $("#confirmPin", form).value;
    const error = $("#changePinError", form);
    const button = form.querySelector('[type="submit"]');

    if (
      !/^[0-9]{6}$/.test(oldPin) ||
      !/^[0-9]{6}$/.test(newPin)
    ) {
      error.textContent = "PIN harus terdiri dari 6 digit angka.";
      return;
    }

    if (newPin !== confirmPin) {
      error.textContent = "Konfirmasi PIN tidak cocok.";
      return;
    }

    if (oldPin === newPin) {
      error.textContent = "PIN baru harus berbeda dari PIN lama.";
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
      await TechOpsAPI.changePin(oldPin, newPin);

      setAuthenticated(false);
      closeDynamicModal();

      notify("PIN berhasil diganti. Silakan login kembali.");

    } catch (error) {
      error.textContent = error.message || "Gagal mengganti PIN.";
      button.disabled = false;
      button.textContent = "Simpan PIN Baru";
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async function handleLogin(event) {
    event.preventDefault();

    const pin = pinInput.value;

    if (!/^[0-9]{6}$/.test(pin)) {
      setLoginError("PIN harus terdiri dari 6 digit angka.");
      pinInput.focus();
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Memeriksa PIN...";
    setLoginError("");

    try {
      const result = await TechOpsAPI.login(pin);

      if (!result?.success || !result.sessionId) {
        throw new Error("Login Admin gagal.");
      }

      const user = result.user ||
        TechOpsAPI.getUser() || {
          nama: "Admin",
          role: "Admin"
        };

      setAuthenticated(true, user);
      closeLogin();

      notify("Login Admin berhasil.");

    } catch (error) {
      setLoginError(error.message || "Login gagal.");
      pinInput.value = "";
      pinInput.focus();

    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Masuk";
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {
    if (!confirm("Yakin ingin keluar dari GoJak TechOps?")) {
      return;
    }

    try {
      await TechOpsAPI.logout();

      setAuthenticated(false);

      notify("Logout berhasil.");

    } catch (error) {
      // API menghapus sesi lokal meskipun permintaan server gagal.
      // Sinkronkan tampilan dengan status sesi lokal tersebut.
      if (!TechOpsAPI.isAuthenticated()) {
        setAuthenticated(false);
      }

      notify("Logout tidak dapat dikonfirmasi ke server: " + error.message);
    }
  }

  // =====================================================
  // PEMULIHAN SESI SAAT HALAMAN DIBUKA
  // =====================================================

  async function restoreSession() {
    try {
      const valid = await TechOpsAPI.validateSession();

      if (valid === true) {
        setAuthenticated(
          true,
          TechOpsAPI.getUser() || {
            nama: "Admin",
            role: "Admin"
          }
        );

      } else if (valid === null && TechOpsAPI.isAuthenticated()) {
        // Gangguan jaringan: pertahankan sesi lokal.
        // Backend tetap wajib memvalidasi setiap operasi Admin.
        setAuthenticated(true, {
          nama: "Admin",
          role: "Admin"
        });

      } else {
        setAuthenticated(false);
      }

    } catch (error) {
      console.warn("Pemulihan sesi Admin:", error);

      if (TechOpsAPI.isAuthenticated()) {
        setAuthenticated(true, {
          nama: "Admin",
          role: "Admin"
        });
      } else {
        setAuthenticated(false);
      }

    } finally {
      state.checking = false;
    }
  }

  // =====================================================
  // EVENT AVATAR DAN MODAL
  // =====================================================

  avatar.addEventListener("click", () => {
    if (state.authenticated) {
      profileMenu();
    } else {
      openLogin();
    }
  });

  $("#closeLoginModal")
    ?.addEventListener("click", closeLogin);

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeLogin();
    }
  });

  // Satu-satunya handler Login: submit form.
  loginForm.addEventListener("submit", handleLogin);

  // =====================================================
  // SINKRONISASI ANTAR-TAB
  // =====================================================

  TechOpsAPI.onAuthChange(auth => {
    // Jangan memanggil validateSession() dari listener ini.
    // validateSession() sendiri memicu notifyAuthChange().
    // Memanggilnya kembali di sini akan membuat loop.
    if (auth.authenticated) {
      setAuthenticated(
        true,
        auth.user || {
          nama: "Admin",
          role: "Admin"
        }
      );
    } else {
      setAuthenticated(false);
    }
  });

  // =====================================================
  // TUTUP MODAL DENGAN ESCAPE
  // =====================================================

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeLogin();
      closeDynamicModal();
      avatar.setAttribute("aria-expanded", "false");
    }
  });

  // =====================================================
  // PUBLIC AUTH STATE UNTUK MODUL LAIN
  // =====================================================

  window.TechOpsAuth = {
    get authenticated() {
      return state.authenticated;
    },

    get user() {
      return state.user;
    },

    logout: logout
  };

  // Mulai pemulihan sesi setelah seluruh listener siap.
  restoreSession();

})();
