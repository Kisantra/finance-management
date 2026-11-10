<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:mysql.users'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'status' => ['required', 'in:active,inactive'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'exists:mysql.roles,name'],
            // Keanggotaan perusahaan. Boleh tidak dikirim sama sekali (formulir lama,
            // atau pemanggil yang tidak peduli) — controller akan mempertahankan
            // keanggotaan yang sudah ada, atau memakai perusahaan aktif untuk user baru.
            // Daftar kosong yang DIKIRIM eksplisit tetap ditolak: pengguna tanpa satu pun
            // perusahaan tidak bisa membuka apa pun dan hanya menimbulkan laporan "akun
            // saya rusak".
            'companies' => ['sometimes', 'array', 'min:1'],
            // Dibatasi ke organisasi perusahaan AKTIF, dan ditolak di sini —
            // bukan disaring diam-diam di controller. Penyaringan diam-diam
            // mengubah "semua perusahaan yang dikirim tidak sah" menjadi "daftar
            // kosong", dan daftar kosong yang lolos ke sync() MENGHAPUS SELURUH
            // keanggotaan pengguna. Ditemukan QC 2026-11-03: aturan `min:1` tidak
            // menolongnya, karena ia memeriksa permintaannya, bukan sisa setelah
            // disaring.
            'companies.*' => [
                'string',
                Rule::exists('mysql.companies', 'id')->where(
                    fn ($q) => $q->where('organization_id', tenant()?->organization_id)
                ),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'companies.min' => __('Pilih minimal satu perusahaan. Pengguna tanpa perusahaan tidak dapat membuka halaman apa pun.'),
            'companies.*.exists' => __('Perusahaan yang dipilih tidak dikenal, atau bukan milik organisasi Anda.'),
        ];
    }
}
