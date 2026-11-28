
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

  // Satu bagian panduan.
  function guideItem(number, title, iconName, content) {
    return `
      <details class="maintenance-form-section">
        <summary class="maintenance-form-section-title">
          <span>${icon(iconName)}</span>
          <h3>${number}. ${title}</h3>
        </summary>

        <div class="maintenance-form">
          ${content}
        </div>
      </details>
    `;
  }

  // Kelompok panduan.
  function guideGroup(title, description, content) {
    return `
      <div class="inventory-page">
        <div class="section-heading">
          <div>
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
        </div>

        <div class="inventory-page">
          ${content}
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="inventory-page">

      <!-- INFORMASI PANDUAN -->
      <section class="glass-card">
        <div class="card-heading">
          <h3>${icon("history")} Informasi Panduan</h3>
          <p>
            Panduan ini dapat dibaca oleh publik.
            Pengelolaan data dan pencatatan maintenance
            tetap memerlukan login.
          </p>
        </div>
      </section>

      <!-- DUA KOLOM PANDUAN -->
      <div class="dashboard-lower-grid">

        <!-- KOLOM KIRI: PENGGUNA UMUM -->
        ${guideGroup(
          "Panduan Pengguna",
          "Fitur yang dapat digunakan oleh pengguna umum.",
          `

          ${guideItem(1, "Dashboard", "monitor", `
            <p>
              Dashboard merupakan halaman ringkasan utama
              GoJak TechOps.
            </p>

            <ol>
              <li><strong>Total Komputer:</strong> jumlah inventaris komputer.</li>
              <li><strong>Total Printer:</strong> jumlah inventaris printer.</li>
              <li><strong>Riwayat Maintenance:</strong> aktivitas yang tercatat.</li>
              <li><strong>Kondisi Baik:</strong> ringkasan kondisi perangkat.</li>
            </ol>

          `)}

          ${guideItem(2, "Komputer", "komputer", `
            <p>
              Halaman Komputer menampilkan daftar inventaris
              dan spesifikasi perangkat.
            </p>

            <ol>
              <li>Computer Name, merek, dan model.</li>
              <li>Serial ID dan pengguna.</li>
              <li>Tahun perolehan.</li>
              <li>CPU, RAM, Storage, GPU, dan OS pada detail perangkat.</li>
            </ol>

            <p><strong>Cara menggunakan:</strong></p>

            <ol>
              <li>Buka menu Komputer.</li>
              <li>Gunakan pencarian untuk menemukan perangkat.</li>
              <li>Klik judul kolom untuk mengurutkan data.</li>
              <li>Buka Detail untuk melihat informasi perangkat.</li>
              <li>Gunakan navigasi halaman untuk data berikutnya.</li>
            </ol>

          `)}

          ${guideItem(3, "Printer", "printer", `
            <p>
              Halaman Printer digunakan untuk melihat daftar
              dan informasi operasional printer.
            </p>

            <ol>
              <li>Serial Number, unit, merek, dan model.</li>
              <li>Jenis tinta.</li>
              <li>Tanggal FTP.</li>
              <li>Masa Pakai (MP).</li>
            </ol>

            <p><strong>Cara menggunakan:</strong></p>

            <ol>
              <li>Buka menu Printer.</li>
              <li>Cari printer melalui kolom pencarian.</li>
              <li>Gunakan judul kolom untuk mengurutkan data.</li>
              <li>Buka Detail untuk melihat informasi printer.</li>
            </ol>

          `)}

          ${guideItem(4, "Maintenance", "history", `
            <p>
              Halaman Maintenance menampilkan catatan perawatan
              dan perbaikan perangkat.
            </p>

            <ol>
              <li><strong>Perawatan:</strong> kegiatan pemeliharaan perangkat.</li>
              <li><strong>Perbaikan:</strong> kegiatan penanganan kerusakan.</li>
            </ol>

          `)}

          ${guideItem(5, "QR Info", "scan", `
            <p>
              untuk mencari informasi dan maintenance.
              Periksa izin kamera.
            </p>

            <ol>
              <li>Tekan tombol QR di navigasi bawah HP.</li>
              <li>Izinkan akses kamera jika diminta.</li>
              <li>Arahkan kamera ke QR perangkat.</li>
              <li>Tunggu sampai perangkat ditemukan.</li>
              <li>Baca informasi perangkat yang ditampilkan.</li>
            </ol>

          `)}

          `
        )}

        <!-- KOLOM KANAN: Teknisi -->
        ${guideGroup(
          "Panduan Teknisi",
          "Fitur pengelolaan yang memerlukan login.",
          `

          ${guideItem(6, "Login dan Logout", "shield", `
            <p><strong>Login:</strong></p>

            <ol>
              <li>Tekan ikon profil GT di kanan atas.</li>
              <li>Masukkan PIN sebanyak 6 digit.</li>
              <li>Tekan Masuk.</li>
              <li>Pastikan status sudah aktif.</li>
            </ol>

            <p><strong>Logout:</strong></p>

            <ol>
              <li>Tekan ikon profil.</li>
              <li>Pilih Keluar.</li>
              <li>Konfirmasi jika diminta.</li>
            </ol>

            <p>
              Jangan membagikan PIN kepada pihak
              yang tidak memiliki kewenangan.
            </p>
          `)}

          ${guideItem(7, "Menambah dan Mengubah Data Perangkat", "package", `
            <p>
              Penambahan dan perubahan data komputer maupun printer
              hanya tersedia setelah login.
            </p>

            <p><strong>Menambah:</strong></p>

            <ol>
              <li>Buka menu Komputer atau Printer.</li>
              <li>Tekan Tambah.</li>
              <li>Isi informasi sesuai data sebenarnya.</li>
              <li>Periksa kembali sebelum menyimpan.</li>
            </ol>

            <p><strong>Mengubah:</strong></p>

            <ol>
              <li>Cari perangkat yang ingin diperbarui.</li>
              <li>Tekan Edit.</li>
              <li>Perbarui informasi yang diperlukan.</li>
              <li>Simpan perubahan.</li>
            </ol>

          `)}

          ${guideItem(8, "Mengarsipkan dan Mengaktifkan", "history", `
            <p>
              Fitur Arsip digunakan untuk menandai perangkat
              yang tidak lagi berada dalam daftar perangkat aktif,
              tanpa menghapus riwayat datanya.
            </p>

            <p><strong>Mengarsipkan:</strong></p>

            <ol>
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
              Teknisi dapat mencatat maintenance melalui hasil pemindaian QR perangkat.
              Jenis kerusakan pada kegiatan Perbaikan dibedakan menjadi Hardware atau Software.
              Jadwal Perawatan selanjutnya akan otomatis terisi.
            </p>

            <ol>
              <li>Buka QR Scanner.</li>
              <li>Pindai QR perangkat yang ditangani.</li>
              <li>Periksa informasi perangkat.</li>
              <li>Pilih Catat Maintenance.</li>
              <li>Isi tanggal dan jenis kegiatan.</li>
              <li>
                Lengkapi keterangan, kondisi, refill,
                dan penanganan sesuai kebutuhan.
              </li>
              <li>Periksa data, lalu simpan.</li>
            </ol>
          `)}

          ${guideItem(10, "Mengganti PIN", "shield", `
            <p>
              PIN dapat diganti melalui menu profil
              setelah berhasil login.
            </p>

            <ol>
              <li>Pastikan sudah login.</li>
              <li>Tekan icon profil.</li>
              <li>Pilih Ganti PIN.</li>
              <li>Masukkan PIN lama.</li>
              <li>Masukkan PIN baru sebanyak 6 digit.</li>
              <li>Masukkan kembali PIN baru untuk konfirmasi.</li>
              <li>Tekan Simpan PIN Baru.</li>
            </ol>
          `)}

          `
        )}

      </div>
    </div>
  `;

  window.TechOpsGuide = {
    render: () => root
  };

})();
