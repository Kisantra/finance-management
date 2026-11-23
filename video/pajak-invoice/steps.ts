import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Admin (atau finance manager) menyalakan PKP, tarif PPN, dan PPh 23 di Profil perusahaan. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-tax-off'),
        focus: around(S['admin-tax-off'].heading, S['admin-tax-off'].pkp, S['admin-tax-off'].pph),
        zoom: 1.35,
        caption: 'Pengaturan › Profil perusahaan, bagian Status PKP & Pajak. Di sini PPN dan PPh 23 dinyalakan untuk seluruh perusahaan.',
        duration: 160,
    },
    {
        src: img('admin-tax-off'),
        focus: S['admin-tax-off'].pkp,
        cursor: S['admin-tax-off'].pkp,
        click: true,
        zoom: 1.6,
        caption: 'Centang Perusahaan adalah Pengusaha Kena Pajak (PKP) bila perusahaan wajib memungut PPN.',
        duration: 130,
    },
    {
        src: img('admin-tax-on'),
        focus: around(S['admin-tax-on'].npwp, S['admin-tax-on'].ppnRate),
        zoom: 1.45,
        caption: 'Isi NPWP dan Tarif PPN, mis. 11. Tarif ini dipakai invoice baru; invoice lama tetap memakai tarifnya sendiri.',
        duration: 170,
    },
    {
        src: img('admin-tax-on'),
        focus: around(S['admin-tax-on'].pph, S['admin-tax-on'].pphRate),
        cursor: S['admin-tax-on'].pph,
        click: true,
        zoom: 1.45,
        caption: 'Centang Klien memotong PPh 23 bila klien biasa memotongnya, isi tarif bawaan (mis. 2), lalu Simpan Perubahan.',
        duration: 170,
    },
];

/** Staff menagih PPN, mengisi faktur, dan memotong PPh 23 di editor invoice. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-tax'),
        focus: S['staff-tax'].ppn,
        zoom: 1.45,
        caption: 'Di editor invoice, kartu Penyesuaian punya sakelar Tagih PPN 11%. Untuk perusahaan PKP, sakelar ini sudah menyala.',
        duration: 150,
    },
    {
        src: img('staff-faktur'),
        focus: S['staff-faktur'].faktur,
        type: S['staff-faktur'].faktur,
        zoom: 1.6,
        caption: 'Isi No. faktur pajak bila sudah ada. Boleh dikosongkan.',
        duration: 120,
    },
    {
        src: img('staff-faktur'),
        focus: around(S['staff-faktur'].pph, S['staff-faktur'].pphRate),
        zoom: 1.4,
        caption: 'Sakelar Dipotong PPh 23 oleh klien juga menyala dengan tarif bawaan 2%. Tarifnya bisa diubah per invoice, mis. 0,5.',
        duration: 160,
    },
    {
        src: img('staff-faktur'),
        focus: S['staff-faktur'].summary,
        zoom: 1.45,
        caption: 'Ringkasan: layanan Rp 10.000.000 + PPN Rp 1.100.000 − PPh 23 Rp 200.000. Total Rp 10.900.000 = yang ditransfer klien.',
        duration: 190,
    },
    {
        src: img('staff-pph-off'),
        focus: around(S['staff-pph-off'].pph, S['staff-pph-off'].total),
        cursor: S['staff-pph-off'].pphSwitch,
        click: true,
        zoom: 1.2,
        caption: 'Klien tidak memotong PPh? Matikan sakelarnya: Total menjadi Rp 11.100.000. Pilihan ini diingat untuk klien itu.',
        duration: 180,
    },
    {
        src: img('staff-drawer'),
        focus: S['staff-drawer'].totals,
        zoom: 1.55,
        chime: true,
        caption: 'Setelah terbit, detail invoice merinci PPN dan potongan PPh 23 di bawah item.',
        duration: 140,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].ppnCard,
        zoom: 1.6,
        caption: 'Kartu PPN di daftar invoice menjumlahkan PPN dari invoice yang sudah terbit.',
        duration: 130,
    },
];
