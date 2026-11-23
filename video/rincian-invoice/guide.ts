import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan rincian isi invoice: Perihal, ATTENTION, keterangan item, item paket, harga bersen — lihat video/guide.ts. */
export const guide: ModuleGuide = {
    slug: 'rincian-invoice',
    title: 'Rincian item invoice',
    group: 'Keuangan',
    order: 12,
    path: '/invoices/create',
    permission: 'view invoices',
    summary:
        'Cara menulis isi invoice agar hasil cetaknya sama dengan dokumen yang biasa dikirim ke klien: **Perihal** dan **ATTENTION** di bagian atas, **keterangan** di bawah nama layanan (pelabuhan, tanggal, nomor nota), **satu harga untuk beberapa pekerjaan** (paket), dan **harga satuan bersen**. Perihal, ATTENTION, dan keterangan tercetak di desain invoice milik perusahaan (mis. PT Bahtera Cipta Bersama atau PT Nusantara Armada Indonesia); template bawaan tidak mencetaknya.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penyusun invoice',
            can: [
                'Mengisi Perihal, ATTENTION, dan keterangan per baris',
                'Menyusun beberapa pekerjaan sebagai satu baris paket',
                'Memakai harga satuan bersen (mis. 4.350,75)',
                'Memeriksa hasil cetak lewat **Pratinjau**',
            ],
            cannot: ['Tidak bisa mengubah invoice setelah tersimpan'],
        },
        {
            role: ROLES.fm,
            who: 'Penerbit',
            can: ['Semua yang bisa dilakukan Staff', 'Mengubah rincian invoice yang sudah tersimpan, juga yang sudah terbit'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager'],
        },
    ],
    tasks: [
        {
            title: 'Mengisi Perihal dan ATTENTION',
            role: ROLES.staff,
            steps: [
                'Di **Buat Invoice**, setelah memilih **Klien**, isi **Perihal**, mis. "Invoice speed boat MV. CONTOH JAYA". Perihal tercetak di baris Perihal pada invoice.',
                'Isi **Untuk perhatian (ATTENTION)** dengan jabatan atau nama penerima di kantor klien, mis. "Direktur Finance & Accounting". Kosongkan untuk memakai PIC dari data klien.',
                'Keduanya opsional dan tidak memengaruhi angka apa pun.',
            ],
        },
        {
            title: 'Menambah keterangan di bawah nama layanan',
            role: ROLES.staff,
            steps: [
                'Di baris item, klik **Tambah keterangan** di bawah nama layanan.',
                'Tulis rinciannya, boleh beberapa baris: pelabuhan muat, tanggal kerja, nomor nota, nomor NTPN, dan sebagainya.',
                'Keterangan tercetak tepat di bawah nama layanan, di dalam kolom yang sama.',
            ],
        },
        {
            title: 'Satu harga untuk beberapa pekerjaan (paket)',
            role: ROLES.staff,
            steps: [
                'Pakai cara ini bila beberapa pekerjaan ditagih dengan **satu harga gabungan**, mis. speed boat pulang-pergi Rp 7.500.000 untuk dua perjalanan.',
                'Buat **satu baris** saja: nama layanan yang merangkum pekerjaannya (mis. "Transportasi speed boat pulang-pergi"), **Qty 1**, satuan **paket**, dan **Harga satuan** = harga gabungannya.',
                'Klik **Tambah keterangan**, lalu tulis setiap pekerjaan di baris sendiri, mis. "1. Dari darat ke MV. CONTOH JAYA, 15 Mei 2026" dan "2. Dari MV. CONTOH JAYA ke darat, 20 Mei 2026".',
                'Jangan memecah harga menjadi dua baris (mis. 2 × Rp 3.750.000) bila dokumen aslinya tidak menyebut harga per pekerjaan, dan jangan menambah baris berharga 0: PDF akan mencetak "0" di kolom harga dan total.',
                'Hasilnya: satu baris bernomor dengan satu harga, dan semua pekerjaan terbaca di kolom keterangan. Subtotal, PPN, dan PPh sama persis dengan dokumen aslinya.',
            ],
        },
        {
            title: 'Memakai harga satuan bersen',
            role: ROLES.staff,
            steps: [
                'Ketik harga dengan **koma** untuk desimal dan titik untuk ribuan, mis. **4.350,75** atau **0,85**. Maksimal dua angka di belakang koma.',
                'Jumlah baris dibulatkan ke Rupiah penuh: 1.250 MT × Rp 4.350,75 = 5.438.437,5 → **Rp 5.438.438**.',
                'Berlaku juga untuk Debit Note.',
            ],
        },
        {
            title: 'Memeriksa hasil cetak',
            role: ROLES.staff,
            steps: [
                'Sebelum menyimpan, klik **Pratinjau** di kanan atas editor untuk melihat PDF dari isian yang belum disimpan.',
                'Setelah tersimpan, buka invoice-nya lalu pilih tab **Pratinjau cetak**: tampilannya sama dengan PDF yang diunduh.',
            ],
        },
    ],
    records: [
        {
            title: 'Contoh baris paket',
            subtitle: 'Dua perjalanan speed boat dengan satu harga gabungan.',
            rows: [
                { label: 'Layanan', value: 'Transportasi speed boat pulang-pergi', source: 'Diisi Staff', tone: 'act' },
                { label: 'Qty & satuan', value: '1 paket', source: 'Diisi Staff', tone: 'act' },
                { label: 'Harga satuan', value: 'Rp 7.500.000', source: 'Diisi Staff', tone: 'act' },
                { label: 'Keterangan', value: '1. Darat → kapal (15 Mei) · 2. Kapal → darat (20 Mei)', source: 'Tambah keterangan', tone: 'wait' },
                { label: 'Subtotal', value: 'Rp 7.500.000', source: 'Otomatis', tone: 'pos' },
            ],
            note: 'PPN dan PPh 23 dihitung dari subtotal yang sama, jadi angkanya cocok dengan dokumen asli.',
        },
    ],
    warnings: [
        {
            title: 'Perihal, ATTENTION, dan keterangan hanya di desain perusahaan',
            body: 'Template bawaan (Kisantra, Generik, Semesta) tidak mencetaknya. Perusahaan dengan desain invoice sendiri mencetak ketiganya.',
        },
        {
            title: 'Satu baris = satu harga',
            body: 'Aplikasi belum bisa menggabungkan sel harga dua baris. Untuk harga gabungan, pakai satu baris paket dengan keterangan bernomor.',
        },
    ],
    matrix: [
        { action: 'Mengisi rincian saat membuat invoice', cells: [true, true, true] },
        { action: 'Mengubah rincian invoice tersimpan', cells: [false, true, true] },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
};
