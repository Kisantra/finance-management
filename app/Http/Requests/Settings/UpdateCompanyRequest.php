<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * '-' ditolak: itu isian sementara saat perusahaan baru diprovisioning
     * (TenantDatabaseSeeder) dan dihitung kosong oleh CompanyProfile::missingFields().
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'not_in:-'],
            'abbreviation' => ['required', 'string', 'min:2', 'max:10', 'alpha:ascii'],
            'address' => ['required', 'string', 'not_in:-'],
            'email' => ['required', 'email'],
            'phone' => ['required', 'string', 'not_in:-'],
            'is_pkp' => ['nullable', 'boolean'],
            'npwp' => ['nullable', 'string'],
            'ppn_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'finance_manager_name' => ['required', 'string', 'not_in:-'],
            'finance_manager_position' => ['required', 'string', 'not_in:-'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'letter_head' => ['nullable', 'image', 'max:2048'],
            'signature' => ['nullable', 'image', 'max:2048'],
            'stamp' => ['nullable', 'image', 'max:2048'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'abbreviation.required' => 'Singkatan perusahaan wajib diisi (dipakai di nomor invoice dan pengajuan dana).',
            'abbreviation.alpha' => 'Singkatan hanya boleh huruf, mis. KSN.',
            'abbreviation.min' => 'Singkatan minimal 2 huruf.',
            'abbreviation.max' => 'Singkatan maksimal 10 huruf.',
            'not_in' => 'Isian ini wajib diisi dengan data sebenarnya.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['abbreviation' => strtoupper(trim((string) $this->input('abbreviation')))]);
    }
}
