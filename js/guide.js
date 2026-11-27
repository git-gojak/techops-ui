
(function () {
  "use strict";

  const root = document.getElementById("guideRoot");

  if (!root) {
    console.warn("Panduan: guideRoot tidak ditemukan.");
    return;
  }

  // Menggunakan ikon bawaan aplikasi.
  function icon(name) {
    return window.TechOpsIcons
      ? window.TechOpsIcons.render(name)
      : "";
  }

  // Tombol navigasi menuju halaman aplikasi.
  function goButton(page, label) {
    return `
      <button
        type="button"
        class="inventory-button inventory-primary"
        data-guide-go="${page}">
        ${label}
      </button>
    `;
  }

  // Satu bagian panduan menggunakan komponen CSS yang sudah ada.
  function guideItem(number, title, iconName, content) {
    return `
      <details class="maintenance-form-section">
        <summary class="maintenance-form-section-title">
          <span>${icon(iconName)}</span>
          <h3>${number}. ${title}</h3>
        </summary>
        <div>
          ${content}
        </div>
      </details>
    `;
  }

  root.innerHTML = `
    <div class="inventory-page">

      <div class="inventory-heading">
        <div>
          <span class="inventory-eyebrow">
            GOJAK TECHOPS
          </span>
          <h2>Panduan Penggunaan</h2>
          <p>
            Petunjuk penggunaan aplikasi untuk pengguna umum
            dan Admin.
          </p>
        </div>
      </div>

      <section class="glass-card">
        <div class="card-heading">
          <h3>${icon("history")} Informasi Panduan</h3>
          <p>
            Panduan ini dapat dibaca oleh semua pengguna.
            Pengelolaan data dan pencatatan maintenance
            tetap memerlukan login Admin.
          </p>
        </div>
      </section>

      <section>
        <div class="section-heading">
          <div>
            <h3>Panduan Pengguna</h3>
            <p>Fitur yang dapat digunakan oleh pengguna umum.</p>
          </div>
        </div>

        <div class="inventory-page">

          ${guideItem(1, "Mengenal Dashboard", "monitor", `
            <p>
              Dashboard merupakan halaman ringkasan utama
              GoJak TechOps.
            </p>
            <ul>
              <li><strong>Total Komputer:</strong> jumlah inventaris komputer.</li>
              <li><strong>Total Printer:</strong> jumlah inventaris printer.</li>
              <li><strong>Riwayat Maintenance:</strong> aktivitas yang tercatat.</li>
              <li><strong>Kondisi Baik:</strong> ringkasan kondisi perangkat.</li>
            </ul>
            <p>
              Dashboard juga menampilkan monitoring perangkat
              berdasarkan unit dan aktivitas maintenance terbaru.
            </p>
            ${goButton("dashboard", "Buka Dashboard")}
          `)}

          ${guideItem(2, "Melihat Inventaris Komputer", "komputer", `
            <p>
              Halaman Komputer menampilkan daftar inventaris
              dan spesifikasi perangkat.
            </p>
            <ul>
              <li>Computer Name, merek, dan model.</li>
              <li>Serial ID dan pengguna.</li>
              <li>Tahun perolehan.</li>
              <li>CPU, RAM, Storage, GPU, dan OS pada detail perangkat.</li>
            </ul>
            <p><strong>Cara menggunakan:</strong></p>
            <ol>
              <li>Buka menu Komputer.</li>
              <li>Gunakan pencarian untuk menemukan perangkat.</li>
              <li>Klik judul kolom untuk mengurutkan data.</li>
              <li>Buka Detail untuk melihat informasi perangkat.</li>
              <li>Gunakan navigasi halaman untuk data berikutnya.</li>
            </ol>
            <p>
              Beberapa informasi dapat disamarkan pada tampilan
              pengguna umum.
            </p>
            ${goButton("computers", "Buka Inventaris Komputer")}
          `)}

          ${guideItem(3, "Melihat Inventaris Printer", "printer", `
            <p>
              Halaman Printer digunakan untuk melihat daftar
              dan informasi operasional printer.
            </p>
            <ul>
              <li>Serial Number, unit, merek, dan model.</li>
              <li>Jenis tinta.</li>
              <li>Tanggal FTP.</li>
              <li>Masa Pakai (MP).</li>
            </ul>
            <p><strong>Cara menggunakan:</strong></p>
            <ol>
              <li>Buka menu Printer.</li>
              <li>Cari printer melalui kolom pencarian.</li>
              <li>Gunakan judul kolom untuk mengurutkan data.</li>
              <li>Buka Detail untuk melihat informasi printer.</li>
            </ol>
            <p>
              Masa Pakai dihitung berdasarkan tanggal FTP
              yang tercatat.
            </p>
            ${goButton("printers", "Buka Inventaris Printer")}
          `)}

          ${guideItem(4, "Membaca Riwayat Maintenance", "history", `
            <p>
              Halaman Maintenance menampilkan catatan perawatan
              dan perbaikan perangkat.
            </p>
            <ul>
              <li><strong>Perawatan:</strong> kegiatan pemeliharaan perangkat.</li>
              <li><strong>Perbaikan:</strong> kegiatan penanganan kerusakan.</li>
            </ul>
            <p>
              Riwayat dapat digunakan untuk melihat kegiatan,
              kondisi perangkat, keterangan pekerjaan,
              dan informasi penanganan sesuai catatan.
            </p>
            <p>
              Pengguna umum dapat membaca riwayat.
              Pencatatan kegiatan baru hanya dapat dilakukan Admin.
            </p>
            ${goButton("maintenance", "Buka Maintenance")}
          `)}

          ${guideItem(5, "Menggunakan QR Info", "scan", `
            <p>
              QR Scanner digunakan untuk mencari informasi
              perangkat melalui QR atau serial perangkat.
            </p>
            <ol>
              <li>Tekan tombol QR di navigasi bawah HP.</li>
              <li>Izinkan akses kamera jika diminta.</li>
              <li>Arahkan kamera ke QR perangkat.</li>
              <li>Tunggu sampai perangkat ditemukan.</li>
              <li>Baca informasi perangkat yang ditampilkan.</li>
            </ol>
            <p>
              Pengguna umum hanya dapat melihat informasi
              perangkat dan riwayat maintenance.
            </p>
            <p>
              Jika kamera tidak terbuka, periksa izin kamera
              browser dan pastikan halaman menggunakan HTTPS.
            </p>
          `)}

        </div>
      </section>

      <section>
        <div class="section-heading">
          <div>
            <h3>Panduan Admin</h3>
            <p>Fitur pengelolaan yang memerlukan login Admin.</p>
          </div>
        </div>

        <div class="inventory-page">

          ${guideItem(6, "Login dan Logout Admin", "shield", `
            <p><strong>Login Admin:</strong></p>
            <ol>
              <li>Tekan ikon profil GT di kanan atas.</li>
              <li>Masukkan PIN Admin sebanyak 6 digit.</li>
              <li>Tekan Masuk.</li>
              <li>Pastikan status Admin sudah aktif.</li>
            </ol>
            <p><strong>Logout Admin:</strong></p>
            <ol>
              <li>Tekan ikon profil Admin.</li>
              <li>Pilih Keluar.</li>
              <li>Konfirmasi jika diminta.</li>
            </ol>
            <p>
              Jangan membagikan PIN Admin kepada pihak
              yang tidak memiliki kewenangan.
            </p>
          `)}

          ${guideItem(7, "Menambah dan Mengubah Data Perangkat", "package", `
            <p>
              Penambahan dan perubahan data komputer maupun printer
              hanya tersedia setelah login Admin.
            </p>
            <p><strong>Menambah perangkat:</strong></p>
            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka menu Komputer atau Printer.</li>
              <li>Tekan Tambah.</li>
              <li>Isi informasi sesuai data sebenarnya.</li>
              <li>Periksa kembali sebelum menyimpan.</li>
            </ol>
            <p><strong>Mengubah data:</strong></p>
            <ol>
              <li>Cari perangkat yang ingin diperbarui.</li>
              <li>Tekan Edit.</li>
              <li>Perbarui informasi yang diperlukan.</li>
              <li>Simpan perubahan.</li>
            </ol>
            <p>
              Pastikan Serial ID atau Serial Number
              tidak tertukar.
            </p>
          `)}

          ${guideItem(8, "Mengarsipkan dan Mengaktifkan Perangkat", "history", `
            <p>
              Fitur Arsip digunakan untuk menandai perangkat
              yang tidak lagi berada dalam daftar perangkat aktif,
              tanpa menghapus riwayat datanya.
            </p>
            <p><strong>Mengarsipkan:</strong></p>
            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka inventaris Komputer atau Printer.</li>
              <li>Cari perangkat yang akan diarsipkan.</li>
              <li>Tekan Arsip dan ikuti konfirmasi.</li>
            </ol>
            <p><strong>Mengaktifkan kembali:</strong></p>
            <ol>
              <li>Temukan perangkat berstatus Arsip.</li>
              <li>Tekan Aktifkan.</li>
              <li>Periksa kembali status perangkat.</li>
            </ol>
          `)}

          ${guideItem(9, "Mencatat Maintenance melalui QR", "scan", `
            <p>
              Admin dapat mencatat maintenance melalui hasil
              pemindaian QR perangkat.
            </p>
            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka QR Scanner.</li>
              <li>Pindai QR perangkat yang ditangani.</li>
              <li>Periksa informasi perangkat.</li>
              <li>Pilih Catat Maintenance.</li>
              <li>Isi tanggal dan jenis kegiatan.</li>
              <li>Lengkapi keterangan, kondisi, refill,
                  dan penanganan sesuai kebutuhan.</li>
              <li>Periksa data, lalu simpan.</li>
            </ol>
            <p>
              Jenis kerusakan pada kegiatan Perbaikan
              dibedakan menjadi Hardware atau Software.
            </p>
            <p>
              Jadwal Perawatan komputer dihitung 6 bulan,
              sedangkan printer 3 bulan. Perbaikan tidak
              menggunakan jadwal otomatis tersebut.
            </p>
          `)}

          ${guideItem(10, "Mengganti PIN Admin", "shield", `
            <p>
              PIN Admin dapat diganti melalui menu profil
              setelah berhasil login.
            </p>
            <ol>
              <li>Login sebagai Admin.</li>
              <li>Tekan ikon profil.</li>
              <li>Pilih Ganti PIN.</li>
              <li>Masukkan PIN lama.</li>
              <li>Masukkan PIN baru sebanyak 6 digit.</li>
              <li>Masukkan kembali PIN baru untuk konfirmasi.</li>
              <li>Tekan Simpan PIN Baru.</li>
            </ol>
            <p>
              Simpan PIN di tempat yang aman dan jangan
              membagikannya kepada orang lain.
            </p>
          `)}

        </div>
      </section>

      <section class="glass-card">
        <div class="card-heading">
          <h3>GoJak TechOps</h3>
          <p>
            Gunakan aplikasi sesuai kewenangan dan pastikan
            data perangkat yang dimasukkan benar.
          </p>
        </div>
      </section>

    </div>
  `;

  // Navigasi dari tombol di dalam Panduan.
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-guide-go]");

    if (!button) return;

    const page = button.dataset.guideGo;

    if (window.TechOps?.navigateTo) {
      window.TechOps.navigateTo(page);
    }
  });

  window.TechOpsGuide = {
    render: () => root
  };

})();
