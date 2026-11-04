<?php

namespace App\Http\Requests;

use App\Rules\DatabasePerusahaanBelumAda;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class SetupRequest extends FormRequest
{
    /** Hanya pemegang tautan sekali pakai dari deploy.sh (lihat SetupController::unlock). */
    public function authorize(): bool
    {
        return (bool) $this->session()->get('setup_unlocked');
    }

    /**
     * Slug mengikuti aturan form Tambah perusahaan (StoreCompanyRequest): permanen, menjadi
     * alamat /c/{slug}, nama database (awalan instalasi + slug), dan folder berkas.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:mysql.users,email'],
            'admin_password' => ['required', 'confirmed', Password::min(8)],
            'company_name' => ['required', 'string', 'max:100'],
            'slug' => [
                'required', 'string', 'min:3', 'max:'.min(40, 64 - strlen((string) config('tenancy.database.prefix'))),
                'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                'unique:mysql.companies,id',
                new DatabasePerusahaanBelumAda,
            ],
            'abbreviation' => ['required', 'string', 'min:2', 'max:10', 'alpha:ascii'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slug.regex' => 'Kode URL hanya boleh huruf kecil, angka, dan strip (mis. pt-kinara).',
            'abbreviation.alpha' => 'Singkatan hanya boleh huruf, mis. KSN.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'slug' => strtolower(trim((string) $this->input('slug'))),
            'abbreviation' => strtoupper(trim((string) $this->input('abbreviation'))),
            'admin_email' => strtolower(trim((string) $this->input('admin_email'))),
        ]);
    }
}
