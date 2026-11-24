
function renderSchedules(map) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(limit.getDate() + 30);

  const latestCare = latestMaintenanceMap(row =>
    activityType(row) === "perawatan"
  );

  // Ambil satu catatan perawatan terbaru untuk setiap perangkat.
  const schedules = [...latestCare.values()]
    .map(row => ({
      row,
      date: dateOf(row.jadwal)
    }))
    .filter(item => item.date)
    .sort((a, b) => {
      const getPriority = date => {
        if (date < today) return 0;
        if (date <= limit) return 1;
        return 2;
      };

      const priorityA = getPriority(a.date);
      const priorityB = getPriority(b.date);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.date - b.date;
    });

  const late = schedules.filter(item => item.date < today);

  const soon = schedules.filter(
    item => item.date >= today && item.date <= limit
  );

  const later = schedules.filter(item => item.date > limit);

  const perPage = 10;
  const totalPages = Math.ceil(schedules.length / perPage);

  schedulePage = Math.min(
    schedulePage,
    Math.max(0, totalPages - 1)
  );

  const startIndex = schedulePage * perPage;
  const endIndex = Math.min(
    startIndex + perPage,
    schedules.length
  );

  const visibleSchedules = schedules.slice(startIndex, endIndex);
  const adminView = isDashboardAdmin();

  const list = visibleSchedules.map(({ row, date }) => {
    const type = typeOf(row.jenis_aset);
    const device = findInventoryDevice(row, map);

    if (type === "komputer") {
      const computerName = adminView
        ? (device?.name || row.nama_aset || "Komputer")
        : (row.nama_aset || "Komputer");

      const computerBrand = adminView
        ? (
            device?.merek ||
            row.manufacturer ||
            row.merek ||
            row.Merek ||
            "Merek tidak tersedia"
          )
        : (
            row.manufacturer ||
            row.merek ||
            row.Merek ||
            "Merek tidak tersedia"
          );

      const computerModel = adminView
        ? (getDeviceModel(row, map) || "Model tidak tersedia")
        : (row.model || row.Model || "");

      const computerSerial = adminView
        ? (device?.serial || row.serial || "-")
        : (row.serial || "");

      const computerDetail = [
        computerBrand,
        computerModel,
        computerSerial
      ]
        .filter(Boolean)
        .map(esc)
        .join(" - ");

      return `
        <div class="dashboard-schedule-item">
          <div>
            <strong>${esc(computerName)}</strong>
            <small>${computerDetail}</small>
          </div>
          <time>${esc(fmtDate(date))}</time>
        </div>
      `;
    }

    const printerUnit = device?.name ||
      row.nama_aset ||
      "Printer";

    const printerBrand = device?.merek ||
      row.merek ||
      row.Merek ||
      "Merek tidak tersedia";

    const printerModel = device?.model ||
      row.model ||
      row.Model ||
      "Model tidak tersedia";

    const printerSerial = device?.serial ||
      row.serial ||
      "-";

    return `
      <div class="dashboard-schedule-item">
        <div>
          <strong>${esc(printerUnit)}</strong>
          <small>
            ${esc(printerBrand)} - ${esc(printerModel)} - ${esc(printerSerial)}
          </small>
        </div>
        <time>${esc(fmtDate(date))}</time>
      </div>
    `;
  }).join("");

  const pagination = totalPages > 1
    ? `
      <div class="dashboard-schedule-pagination"
        style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;">

        <small style="color:var(--text-secondary,#888);">
          ${startIndex + 1}–${endIndex} dari ${schedules.length} jadwal
        </small>

        <div style="display:flex;gap:8px;">
          <button
            type="button"
            id="schedulePrev"
            aria-label="Halaman sebelumnya"
            title="Sebelumnya"
            ${schedulePage === 0 ? "disabled" : ""}
            style="width:34px;height:34px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${schedulePage === 0 ? "0.4" : "1"};">

            <svg viewBox="0 0 24 24" width="18" height="18"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>

          <button
            type="button"
            id="scheduleNext"
            aria-label="Halaman berikutnya"
            title="Berikutnya"
            ${schedulePage >= totalPages - 1 ? "disabled" : ""}
            style="width:34px;height:34px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${schedulePage >= totalPages - 1 ? "0.4" : "1"};">

            <svg viewBox="0 0 24 24" width="18" height="18"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    `
    : schedules.length
      ? `<small class="dashboard-more">${schedules.length} jadwal</small>`
      : "";

  $("#dashboardSchedules").innerHTML = `
    <div class="dashboard-schedule-summary">
      <div class="schedule-overdue">
        <strong>${late.length}</strong>
        <span>Terlambat</span>
      </div>

      <div class="schedule-upcoming">
        <strong>${soon.length}</strong>
        <span>Segera · 30 hari</span>
      </div>

      <div class="schedule-future">
        <strong>${later.length}</strong>
        <span>Terjadwal</span>
      </div>
    </div>

    ${
      list
        ? `<div class="dashboard-schedule-list">${list}</div>`
        : `
          <div class="dashboard-empty">
            Belum ada jadwal perawatan.
          </div>
        `
    }

    ${pagination}
  `;

  $("#schedulePrev")?.addEventListener("click", () => {
    if (schedulePage > 0) {
      schedulePage--;
      renderSchedules(map);
    }
  });

  $("#scheduleNext")?.addEventListener("click", () => {
    if (schedulePage < totalPages - 1) {
      schedulePage++;
      renderSchedules(map);
    }
  });
}
