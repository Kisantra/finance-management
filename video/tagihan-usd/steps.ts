import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff menyusun dan menerbitkan tagihan USD. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-new'),
        focus: S['staff-new'].currency,
        cursor: S['staff-new'].usd,
        click: true,
        zoom: 1.5,
        caption: 'Buat invoice seperti biasa, lalu pada Mata uang tagihan pilih USD.',
        duration: 110,
    },
    {
        src: img('staff-usd'),
        focus: around(S['staff-usd'].rateBlock, S['staff-usd'].info),
        zoom: 1.3,
        caption: 'Isian Kurs (Rp per 1 USD) muncul. Klien berutang dalam USD; pembukuan perusahaan tetap Rupiah dengan kurs ini.',
        duration: 160,
    },
    {
        src: img('staff-rate'),
        focus: S['staff-rate'].rate,
        type: S['staff-rate'].rate,
        zoom: 1.6,
        caption: 'Ketik kurs hari itu, mis. 18.300. Biasanya sudah terisi kurs terakhir; ganti bila kurs sudah berubah.',
        duration: 140,
    },
    {
        src: img('staff-item-rp'),
        focus: S['staff-item-rp'].row1,
        cursor: S['staff-item-rp'].usdToggle,
        click: true,
        zoom: 1.4,
        caption: 'Isi layanan, Qty, dan satuan (20.000 MT). Lalu nyalakan Harga USD di baris itu.',
        duration: 140,
    },
    {
        src: img('staff-item'),
        focus: S['staff-item'].row1,
        zoom: 1.35,
        caption: 'Ketik harga per unit dalam USD: 0,82. Di bawahnya tampil Rupiahnya (Rp 15.006 per MT) dan subtotal Rp 300.120.000.',
        duration: 170,
    },
    {
        src: img('staff-totals'),
        focus: around(S['staff-totals'].ppn, S['staff-totals'].pph),
        zoom: 1.35,
        caption: 'Contoh ini tanpa PPN dan PPh 23. Bila dinyalakan, keduanya tetap dihitung dalam Rupiah.',
        duration: 130,
    },
    {
        src: img('staff-totals'),
        focus: S['staff-totals'].summary,
        zoom: 1.45,
        caption: 'Ringkasan menampilkan Total dalam Rupiah dan Tagihan USD (total ÷ kurs): USD 16.400,00, inilah yang dibayar klien.',
        duration: 170,
    },
    {
        src: img('staff-drawer'),
        focus: S['staff-drawer'].metrics,
        zoom: 1.3,
        chime: true,
        caption: 'Setelah Simpan & terbitkan, tagihan, pembayaran, dan sisa tampil dalam USD, dengan Rupiah dan kursnya di bawah.',
        duration: 160,
    },
];

/** Finance manager mencatat pembayaran USD dengan kurs saat diterima. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-pay'),
        focus: around(S['fm-pay'].received, S['fm-pay'].rate, S['fm-pay'].result),
        zoom: 1.45,
        caption: 'Saat uang klien diterima, klik Catat pembayaran. Isinya dalam USD: Diterima (USD) dan Kurs saat diterima.',
        duration: 160,
    },
    {
        src: img('fm-pay-rate'),
        focus: around(S['fm-pay-rate'].rate, S['fm-pay-rate'].rateHint, S['fm-pay-rate'].result),
        zoom: 1.55,
        caption: 'Kurs saat bank mengonversi: Rp 18.400, lebih tinggi dari kurs invoice. Masuk ke rekening: Rp 301.760.000.',
        duration: 160,
    },
    {
        src: img('fm-pay-rate'),
        focus: S['fm-pay-rate'].account,
        cursor: S['fm-pay-rate'].account,
        click: true,
        zoom: 1.5,
        caption: 'Pilih Rekening tujuan, yaitu rekening Rupiah tempat uang hasil konversi masuk.',
        duration: 120,
    },
    {
        src: img('fm-pay-journal'),
        focus: S['fm-pay-journal'].journal,
        zoom: 1.35,
        caption: 'Jurnal: pendapatan tetap Rp 300.120.000 sesuai kurs invoice; kelebihan Rp 1.640.000 masuk Selisih Kurs (laba).',
        duration: 180,
    },
    {
        src: img('fm-paid'),
        focus: around(S['fm-paid'].status, S['fm-paid'].metrics),
        zoom: 1.25,
        chime: true,
        caption: 'Klik Simpan pembayaran. Status Lunas karena USD 16.400 sudah diterima penuh; sisa tagihan USD 0,00.',
        duration: 150,
    },
    {
        src: img('fm-paid'),
        focus: S['fm-paid'].payments,
        zoom: 1.5,
        caption: 'Kartu Pembayaran mencatat jumlah USD, Rupiah yang masuk, dan kurs saat diterima.',
        duration: 130,
    },
];

/** Admin menyalakan Tagihan USD dan menambah rekening USD. */
export const ADMIN_SETUP_STEPS: Step[] = [
    {
        src: img('admin-usd'),
        focus: S['admin-usd'].section,
        cursor: S['admin-usd'].check,
        click: true,
        zoom: 1.35,
        caption: 'Tagihan USD dinyalakan sekali di Pengaturan › Profil perusahaan: centang Perusahaan ini bisa menagih dalam USD.',
        duration: 160,
    },
    {
        src: img('admin-bank'),
        focus: around(S['admin-bank'].currency, S['admin-bank'].branch, S['admin-bank'].swift),
        zoom: 1.4,
        caption: 'Di Rekening Pembayaran, tambahkan rekening USD: Mata uang rekening USD, Cabang, dan Kode Swift. Rekening ini tercetak di tagihan USD.',
        duration: 180,
    },
];
