<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage companies');
    }

    public function rules(): array
    {
        return [
            'slug' => [
                'required', 'string', 'min:3', 'max:40',
                // Slug = id tenant = nama database = path storage — PERMANEN.
                // Huruf kecil/angka/strip; tidak boleh diawali/diakhiri strip.
                'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                // Prefix koneksi central WAJIB: di dalam konteks tenant, koneksi
                // default menunjuk DB perusahaan — tabel companies ada di central
                'unique:mysql.companies,id',
            ],
            'name' => ['required', 'string', 'max:100'],
            'abbreviation' => ['required', 'string', 'min:2', 'max:10', 'alpha:ascii'],
        ];
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'Kode URL hanya boleh huruf kecil, angka, dan strip (mis. pt-kinara).',
            'slug.unique' => 'Kode URL sudah dipakai perusahaan lain.',
            'abbreviation.alpha' => 'Singkatan hanya boleh huruf (dipakai pada nomor invoice).',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'slug' => strtolower(trim((string) $this->input('slug'))),
            'abbreviation' => strtoupper(trim((string) $this->input('abbreviation'))),
        ]);
    }
}
