<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

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
            'companies.*' => ['string', 'exists:mysql.companies,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'companies.min' => 'Pilih minimal satu perusahaan. Pengguna tanpa perusahaan tidak dapat membuka halaman apa pun.',
            'companies.*.exists' => 'Perusahaan yang dipilih tidak dikenal.',
        ];
    }
}
