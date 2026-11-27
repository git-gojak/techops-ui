
(function () {
  "use strict";

  const root = document.getElementById("guideRoot");

  if (!root) {
    console.warn("Panduan: elemen guideRoot tidak ditemukan.");
    return;
  }

  // =====================================================
  // STYLE PANDUAN
  // =====================================================

  const style = document.createElement("style");

  style.textContent = `
    #guideRoot {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
    }

    .guide-intro {
      padding: 24px;
      margin-bottom: 22px;
      border-radius: 16px;
      background: var(--card-bg, rgba(255,255,255,.04));
      border: 1px solid var(--border-color, rgba(255,255,255,.1));
    }

    .guide-intro h2 {
      margin: 0 0 9px;
      font-size: 1.35rem;
    }

    .guide-intro p {
      margin: 0;
      line-height: 1.7;
      opacity: .8;
    }

    .guide-notice {
      margin-top: 16px;
      padding: 13px 15px;
      border-radius: 10px;
      background: rgba(59,130,246,.09);
      border: 1px solid rgba(59,130,246,.2);
      font-size: .9rem;
      line-height: 1.6;
    }

    .guide-group {
      margin-bottom: 22px;
    }

    .guide-group-title {
      margin: 0 0 12px;
      font-size: 1rem;
      font-weight: 700;
    }

    .guide-accordion {
      display: grid;
      gap: 10px;
    }

    .guide-item {
      overflow: hidden;
      border: 1px solid var(--border-color, rgba(255,255,255,.1));
      border-radius: 12px;
      background: var(--card-bg, rgba(255,255,255,.035));
    }

    .guide-item summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      cursor: pointer;
      list-style: none;
      font-weight: 600;
      line-height: 1.5;
    }

    .guide-item summary::-webkit-details-marker {
      display: none;
    }

    .guide-item summary::after {
      content: "+";
      flex: 0 0 auto;
      font-size: 1.35rem;
      font-weight: 400;
      opacity: .7;
    }

    .guide-item[open] summary::after {
      content: "−";
    }

    .guide-item summary:hover {
      background: rgba(127,127,127,.07);
    }

    .guide-content {
      padding: 0 16px 17px;
      line-height: 1.75;
      font-size: .93rem;
      opacity: .9;
    }

    .guide-content p {
      margin: 0 0 10px;
    }

    .guide-content ol,
    .guide-content ul {
      padding-left: 21px;
      margin: 8px 0 12px;
    }

    .guide-content li {
      margin-bottom: 6px;
    }

    .guide-content strong {
      font-weight: 700;
    }

    .guide-tip {
      padding: 11px 13px;
      margin-top: 12px;
      border-radius: 9px;
      background: rgba(16,185,129,.08);
      border: 1px solid rgba(16,185,129,.18);
      font-size: .88rem;
    }

    .guide-warning {
      padding: 11px 13px;
      margin-top: 12px;
      border-radius: 9px;
      background: rgba(245,158,11,.08);
      border: 1px solid rgba(245,158,11,.2);
      font-size: .88rem;
    }

    .guide-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 16px;
    }

    .guide-go-button {
      border: 1px solid var(--border-color, rgba(255,255,255,.15));
      border-radius: 9px;
      padding: 10px 14px;
      background: rgba(127,127,127,.09);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .guide-go-button:hover {
      background: rgba(127,127,127,.17);
    }

    .guide-footer {
      margin: 24px 0 8px;
      padding: 16px;
      border-top: 1px solid var(--border-color, rgba(255,255,255,.1));
      font-size: .85rem;
      line-height: 1.6;
      opacity: .7;
      text-align: center;
    }

    @media (max-width: 760px) {
      .guide-intro {
        padding: 18px;
      }

      .guide-item summary {
        padding: 14px;
      }

      .guide-content {
        padding: 0 14px 15px;
      }

      .guide-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .guide-go-button {
        width: 100%;
        text-align: left;
      }
    }
  `;

  document.head.appendChild(style);

  // =====================================================
  // ISI PANDUAN
  // =====================================================

  root.innerHTML = `

    <div class="guide-intro">

      <h2>Panduan Penggunaan GoJak TechOps</h2>

      <p>
        Halaman ini berisi petunjuk penggunaan aplikasi
        untuk melihat inventaris, memantau kondisi perangkat,
        membaca riwayat maintenance, dan menggunakan fitur Admin.
      </p>

      <div class="guide-notice">
        <strong>Informasi:</strong>
        Panduan dapat dibaca oleh semua pengguna.
        Namun, penambahan, perubahan, pengarsipan perangkat,
        dan pencatatan maintenance tetap memerlukan login Admin.
      </div>

    </div>

    <!-- PANDUAN PENGGUNA -->
    <section class="guide-group">

      <h3 class="guide-group-title">PANDUAN PENGGUNA</h3>

      <div class="guide-accordion">

        <details class="guide-item">
          <summary>1. Mengenal Dashboard</summary>

          <div class="guide-content">

            <p>
              Dashboard merupakan halaman ringkasan utama
              GoJak TechOps.
            </p>

            <p>Informasi yang ditampilkan meliputi:</p>

            <ul>
              <li><strong>Total Komputer:</strong> jumlah inventaris komputer.</li>
              <li><strong>Total Printer:</strong> jumlah inventaris printer.</li>
              <li><strong>Riwayat Maintenance:</strong> jumlah aktivitas yang tercatat.</li>
              <li><strong>Kondisi Baik:</strong> ringkasan perangkat dengan kondisi baik.</li>
            </ul>

            <p>
              Dashboard juga menyediakan ringkasan perangkat
              berdasarkan unit dan aktivitas maintenance terbaru.
            </p>

            <div class="guide-tip">
              Gunakan Dashboard untuk melihat gambaran umum
              kondisi inventaris dan aktivitas operasional IT.
            </div>

            <div class="guide-actions">
              <button class="guide-go-button" data-guide-go="dashboard">
                Buka Dashboard
              </button>
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>2. Melihat Inventaris Komputer</summary>

          <div class="guide-content">

            <p>
              Halaman Komputer digunakan untuk melihat data
              inventaris dan spesifikasi komputer.
            </p>

            <p>Informasi yang tersedia antara lain:</p>

            <ul>
              <li>Computer Name.</li>
              <li>Manufacturer dan Model.</li>
              <li>Asset / Serial ID.</li>
              <li>Pengguna.</li>
              <li>Tahun perolehan.</li>
              <li>Spesifikasi seperti CPU, RAM, Storage, GPU, dan OS pada detail perangkat.</li>
            </ul>

            <p><strong>Cara menggunakan halaman:</strong></p>

            <ol>
              <li>Buka menu Komputer.</li>
              <li>Gunakan kolom pencarian untuk menemukan perangkat.</li>
              <li>Klik judul kolom untuk mengurutkan data.</li>
              <li>Gunakan tombol Detail untuk melihat informasi perangkat.</li>
              <li>Gunakan navigasi halaman untuk melihat data berikutnya.</li>
            </ol>

            <div class="guide-tip">
              Data yang ditampilkan untuk pengguna umum dapat
              memiliki beberapa informasi yang disamarkan.
            </div>

            <div class="guide-actions">
              <button class="guide-go-button" data-guide-go="computers">
                Buka Inventaris Komputer
              </button>
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>3. Melihat Inventaris Printer</summary>

          <div class="guide-content">

            <p>
              Halaman Printer digunakan untuk melihat daftar
              dan informasi operasional perangkat printer.
            </p>

            <p>Informasi yang tersedia antara lain:</p>

            <ul>
              <li>Serial Number.</li>
              <li>Unit.</li>
              <li>Merek dan Model.</li>
              <li>Jenis tinta.</li>
              <li>Tanggal FTP.</li>
              <li>Masa Pakai (MP).</li>
            </ul>

            <p><strong>Cara menggunakan halaman:</strong></p>

            <ol>
              <li>Buka menu Printer.</li>
              <li>Gunakan pencarian untuk menemukan printer.</li>
              <li>Klik judul kolom untuk mengurutkan data.</li>
              <li>Klik Detail untuk melihat informasi perangkat.</li>
              <li>Gunakan navigasi halaman jika data lebih dari satu halaman.</li>
            </ol>

            <div class="guide-tip">
              Masa Pakai dihitung berdasarkan tanggal FTP
              yang tercatat pada data printer.
            </div>

            <div class="guide-actions">
              <button class="guide-go-button" data-guide-go="printers">
                Buka Inventaris Printer
              </button>
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>4. Membaca Riwayat Maintenance</summary>

          <div class="guide-content">

            <p>
              Halaman Maintenance digunakan untuk melihat
              catatan perawatan dan perbaikan perangkat.
            </p>

            <p>Jenis kegiatan maintenance terdiri dari:</p>

            <ul>
              <li><strong>Perawatan:</strong> kegiatan pemeliharaan perangkat.</li>
              <li><strong>Perbaikan:</strong> kegiatan penanganan kerusakan perangkat.</li>
            </ul>

            <p>
              Riwayat dapat digunakan untuk mengetahui
              kegiatan yang pernah dilakukan, kondisi perangkat,
              keterangan pekerjaan, dan informasi penanganannya
              sesuai data yang tercatat.
            </p>

            <div class="guide-tip">
              Pengguna umum dapat melihat riwayat maintenance.
              Pencatatan kegiatan baru hanya dapat dilakukan Admin.
            </div>

            <div class="guide-actions">
              <button class="guide-go-button" data-guide-go="maintenance">
                Buka Riwayat Maintenance
              </button>
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>5. Menggunakan QR Info</summary>

          <div class="guide-content">

            <p>
              QR Scanner digunakan untuk mencari informasi
              perangkat melalui QR atau serial perangkat.
            </p>

            <p><strong>Cara menggunakan QR Scanner:</strong></p>

            <ol>
              <li>Tekan tombol QR di bagian tengah navigasi bawah HP.</li>
              <li>Izinkan akses kamera jika diminta oleh browser.</li>
              <li>Arahkan kamera ke QR perangkat.</li>
              <li>Tunggu sampai informasi perangkat ditemukan.</li>
              <li>Baca detail perangkat dan riwayat maintenance yang tersedia.</li>
            </ol>

            <p>
              Pengguna umum hanya dapat melihat informasi perangkat
              dan riwayat maintenance.
            </p>

            <div class="guide-warning">
              Jika kamera tidak terbuka, pastikan browser memiliki
              izin menggunakan kamera dan halaman dibuka melalui HTTPS.
            </div>

          </div>
        </details>

      </div>
    </section>

    <!-- PANDUAN ADMIN -->
    <section class="guide-group">

      <h3 class="guide-group-title">PANDUAN ADMIN</h3>

      <div class="guide-accordion">

        <details class="guide-item">
          <summary>6. Login dan Logout Admin</summary>

          <div class="guide-content">

            <p><strong>Login Admin:</strong></p>

            <ol>
              <li>Tekan ikon profil bertuliskan GT di kanan atas.</li>
              <li>Masukkan PIN Admin sebanyak 6 digit.</li>
              <li>Tekan tombol Masuk.</li>
              <li>Setelah berhasil, aplikasi akan menampilkan status Admin.</li>
            </ol>

            <p><strong>Logout Admin:</strong></p>

            <ol>
              <li>Tekan ikon profil Admin.</li>
              <li>Pilih Keluar.</li>
              <li>Konfirmasi jika diminta.</li>
            </ol>

            <div class="guide-warning">
              Jangan membagikan PIN Admin kepada pengguna
              yang tidak memiliki kewenangan.
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>7. Menambah dan Mengubah Data Perangkat</summary>

          <div class="guide-content">

            <p>
              Penambahan dan perubahan data komputer maupun printer
              hanya tersedia setelah login Admin.
            </p>

            <p><strong>Untuk menambah perangkat:</strong></p>

            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka menu Komputer atau Printer.</li>
              <li>Tekan tombol Tambah.</li>
              <li>Isi informasi perangkat sesuai data sebenarnya.</li>
              <li>Periksa kembali isian sebelum menyimpan.</li>
            </ol>

            <p><strong>Untuk mengubah data:</strong></p>

            <ol>
              <li>Cari perangkat yang ingin diperbarui.</li>
              <li>Tekan tombol Edit pada perangkat tersebut.</li>
              <li>Perbarui informasi yang diperlukan.</li>
              <li>Simpan perubahan.</li>
            </ol>

            <div class="guide-tip">
              Periksa kembali Serial ID atau Serial Number
              agar data perangkat tidak tertukar.
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>8. Mengarsipkan dan Mengaktifkan Perangkat</summary>

          <div class="guide-content">

            <p>
              Fitur Arsip digunakan untuk menandai perangkat
              yang tidak lagi berada dalam daftar perangkat aktif,
              tanpa menghapus riwayat datanya.
            </p>

            <p><strong>Mengarsipkan perangkat:</strong></p>

            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka inventaris Komputer atau Printer.</li>
              <li>Cari perangkat yang akan diarsipkan.</li>
              <li>Tekan tombol Arsip.</li>
              <li>Ikuti konfirmasi jika ditampilkan.</li>
            </ol>

            <p><strong>Mengaktifkan kembali:</strong></p>

            <ol>
              <li>Temukan perangkat yang berstatus Arsip.</li>
              <li>Tekan tombol Aktifkan.</li>
              <li>Periksa kembali status perangkat.</li>
            </ol>

            <div class="guide-warning">
              Pastikan perangkat yang dipilih sudah benar
              sebelum melakukan perubahan status.
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>9. Mencatat Maintenance melalui QR</summary>

          <div class="guide-content">

            <p>
              Admin dapat membuka pencatatan maintenance
              melalui hasil pemindaian QR perangkat.
            </p>

            <ol>
              <li>Login sebagai Admin.</li>
              <li>Buka QR Scanner.</li>
              <li>Pindai QR perangkat yang akan ditangani.</li>
              <li>Periksa informasi perangkat yang ditemukan.</li>
              <li>Pilih Catat Maintenance.</li>
              <li>Isi tanggal dan jenis kegiatan.</li>
              <li>Lengkapi informasi pekerjaan, kondisi, refill, dan penanganan sesuai kebutuhan.</li>
              <li>Periksa kembali data, lalu simpan.</li>
            </ol>

            <p>
              Untuk kegiatan Perbaikan, jenis kerusakan
              dibedakan menjadi Hardware atau Software.
            </p>

            <p>
              Jadwal Perawatan dihitung berdasarkan jenis perangkat:
              komputer 6 bulan dan printer 3 bulan.
              Kegiatan Perbaikan tidak menggunakan jadwal
              perawatan otomatis tersebut.
            </p>

            <div class="guide-warning">
              Pastikan QR yang dipindai sesuai dengan perangkat
              yang benar-benar dikerjakan.
            </div>

          </div>
        </details>

        <details class="guide-item">
          <summary>10. Mengganti PIN Admin</summary>

          <div class="guide-content">

            <p>
              PIN Admin dapat diganti melalui menu profil
              setelah berhasil login.
            </p>

            <ol>
              <li>Login sebagai Admin.</li>
              <li>Tekan ikon profil di kanan atas.</li>
              <li>Pilih Ganti PIN.</li>
              <li>Masukkan PIN lama.</li>
              <li>Masukkan PIN baru sebanyak 6 digit.</li>
              <li>Masukkan kembali PIN baru untuk konfirmasi.</li>
              <li>Tekan Simpan PIN Baru.</li>
              <li>Login kembali menggunakan PIN yang baru.</li>
            </ol>

            <div class="guide-warning">
              PIN baru harus berbeda dari PIN lama.
              Simpan PIN di tempat yang aman.
            </div>

          </div>
        </details>

      </div>
    </section>

    <div class="guide-footer">
      GoJak TechOps — Panduan Penggunaan Aplikasi<br>
      Gunakan aplikasi sesuai kewenangan dan pastikan
      data perangkat yang dimasukkan benar.
    </div>

  `;

  // =====================================================
  // TOMBOL NAVIGASI DARI PANDUAN
  // =====================================================

  root.addEventListener("click", event => {
    const button = event.target.closest("[data-guide-go]");

    if (!button) return;

    const page = button.dataset.guideGo;

    if (window.TechOps?.navigateTo) {
      window.TechOps.navigateTo(page);
    }
  });

  // =====================================================
  // PUBLIC MODULE
  // =====================================================

  window.TechOpsGuide = {
    render: () => {
      // Konten panduan sudah dirender saat file dimuat.
      return root;
    }
  };

})();
