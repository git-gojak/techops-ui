
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
  const pinInput = $("#adminPin");
  const loginButton = $("#loginButton");

  function initials(user) {
    const name = String(
      user?.nama || user?.name ||
      user?.username || "Admin"
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

  function closeLogin() {
    modal.classList.remove("open");
    pinInput.value = "";
  }

  function openLogin() {
    if (state.checking) {
      notify("Sedang memeriksa sesi Admin.");
      return;
    }

    modal.classList.add("open");
    pinInput.focus();
  }

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
  }

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
        <button class="modal-close" aria-label="Tutup">×</button>
        <div class="modal-logo">${initials(user)}</div>
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
      if (event.target === overlay) overlay.remove();
    });
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

  function profileMenu() {
    closeDynamicModal();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "techOpsProfileMenu";

    overlay.innerHTML = `
      <section class="modal-card profile-menu-card">
        <button class="modal-close" aria-label="Tutup">×</button>
        <div class="modal-logo">${initials(state.user)}</div>
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

    overlay.querySelector(".modal-close")
      .addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });

    overlay.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        overlay.remove();

        if (action === "profile") showProfile();
        if (action === "pin") showChangePin();
        if (action === "logout") logout();
      });
    });
  }

  function showChangePin() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "techOpsChangePinModal";

    overlay.innerHTML = `
      <section class="modal-card">
        <button class="modal-close" aria-label="Tutup">×</button>
        <div class="modal-logo">GT</div>
        <h2>Ganti PIN Admin</h2>
        <p class="modal-description">
          Masukkan PIN lama dan PIN baru.
        </p>

        <form id="changePinForm">
          <label>PIN Lama</label>
          <input id="oldPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" required>

          <label>PIN Baru</label>
          <input id="newPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" required>

          <label>Konfirmasi PIN Baru</label>
          <input id="confirmPin" type="password"
            inputmode="numeric" maxlength="6"
            pattern="[0-9]{6}" required>

          <p id="changePinError" class="auth-error"></p>

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
      if (event.target === overlay) overlay.remove();
    });

    $("#changePinForm", overlay)
      .addEventListener("submit", changePin);
  }

  async function changePin(event) {
    event.preventDefault();

    const oldPin = $("#oldPin").value;
    const newPin = $("#newPin").value;
    const confirmPin = $("#confirmPin").value;
    const error = $("#changePinError");
    const button = event.submitter;

    if (!/^[0-9]{6}$/.test(oldPin) ||
        !/^[0-9]{6}$/.test(newPin)) {
      error.textContent = "PIN harus 6 digit angka.";
      return;
    }

    if (newPin !== confirmPin) {
      error.textContent = "Konfirmasi PIN tidak cocok.";
      return;
    }

    if (oldPin === newPin) {
      error.textContent = "PIN baru harus berbeda.";
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
      await TechOpsAPI.changePin(oldPin, newPin);

      state.user = null;
      state.authenticated = false;

      closeDynamicModal();
      closeLogin();
      updateAvatar();

      notify("PIN berhasil diganti. Silakan login kembali.");

    } catch (err) {
      error.textContent = err.message || "Gagal mengganti PIN.";
      button.disabled = false;
      button.textContent = "Simpan PIN Baru";
    }
  }

  async function handleLogin() {
    const pin = pinInput.value;

    if (!/^[0-9]{6}$/.test(pin)) {
      notify("PIN harus terdiri dari 6 digit angka.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Memeriksa PIN...";

    try {
      const result = await TechOpsAPI.login(pin);

      if (!result?.success || !result.sessionId) {
        throw new Error("Login Admin gagal.");
      }

      state.user = result.user ||
        TechOpsAPI.getUser() || {
          nama: "Admin",
          role: "Admin"
        };

      state.authenticated = true;

      updateAvatar();
      closeLogin();

      document.dispatchEvent(
        new CustomEvent("techops:authchange", {
          detail: {
            authenticated: true,
            user: state.user
          }
        })
      );

      notify("Login Admin berhasil.");

    } catch (err) {
      notify(err.message || "Login gagal.");
      pinInput.value = "";
      pinInput.focus();

    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Masuk";
    }
  }

  async function logout() {
    if (!confirm("Yakin ingin keluar dari GoJak TechOps?")) {
      return;
    }

    try {
      await TechOpsAPI.logout();

      state.user = null;
      state.authenticated = false;

      closeDynamicModal();
      updateAvatar();

      document.dispatchEvent(
        new CustomEvent("techops:authchange", {
          detail: {
            authenticated: false,
            user: null
          }
        })
      );

      notify("Logout berhasil.");

    } catch (err) {
      notify("Logout gagal: " + err.message);
    }
  }

  async function restoreSession() {
    try {
      const valid = await TechOpsAPI.validateSession();

      if (valid === true) {
        state.user = TechOpsAPI.getUser() || {
          nama: "Admin",
          role: "Admin"
        };

        state.authenticated = true;
      } else {
        state.user = null;
        state.authenticated = false;
      }

    } catch (err) {
      console.warn("Pemulihan sesi:", err);
      state.user = null;
      state.authenticated = false;

    } finally {
      state.checking = false;
      updateAvatar();
    }
  }

  avatar.addEventListener("click", () => {
    if (state.authenticated) {
      profileMenu();
    } else {
      openLogin();
    }
  });

  $("#closeLoginModal").addEventListener("click", closeLogin);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeLogin();
  });

  loginButton.addEventListener("click", handleLogin);

  pinInput.addEventListener("keydown", event => {
    if (event.key === "Enter") handleLogin();
  });

  // Sinkronisasi status autentikasi antar-tab.
  TechOpsAPI.onAuthChange(async auth => {
    if (auth.authenticated) {
      const valid = await TechOpsAPI.validateSession();

      if (valid === true) {
        state.user = TechOpsAPI.getUser() || {
          nama: "Admin",
          role: "Admin"
        };
        state.authenticated = true;
      }
    } else {
      state.user = null;
      state.authenticated = false;
    }

    updateAvatar();

    document.dispatchEvent(
      new CustomEvent("techops:authchange", {
        detail: {
          authenticated: state.authenticated,
          user: state.user
        }
      })
    );
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeLogin();
      closeDynamicModal();
    }
  });

  restoreSession();

  window.TechOpsAuth = {
    get authenticated() {
      return state.authenticated;
    },
    get user() {
      return state.user;
    },
    logout
  };

})();
