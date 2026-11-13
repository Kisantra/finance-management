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
            'signature_city' => ['nullable', 'string', 'max:100'],
            'bank_accounts' => ['nullable', 'array', 'max:5'],
            'bank_accounts.*.bank' => ['required', 'string', 'max:100'],
            'bank_accounts.*.account_number' => ['required', 'string', 'max:50'],
            'bank_accounts.*.account_name' => ['required', 'string', 'max:255'],
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
            'abbreviation.required' => __('Singkatan perusahaan wajib diisi (dipakai di nomor invoice dan pengajuan dana).'),
            'abbreviation.alpha' => __('Singkatan hanya boleh huruf, mis. KSN.'),
            'abbreviation.min' => __('Singkatan minimal 2 huruf.'),
            'abbreviation.max' => __('Singkatan maksimal 10 huruf.'),
            'not_in' => __('Isian ini wajib diisi dengan data sebenarnya.'),
            'signature_city.max' => __('Kota tanda tangan maksimal 100 karakter.'),
            'bank_accounts.max' => __('Maksimal 5 rekening.'),
            'bank_accounts.*.bank.required' => __('Nama bank rekening :position wajib diisi.'),
            'bank_accounts.*.bank.max' => __('Nama bank rekening :position maksimal 100 karakter.'),
            'bank_accounts.*.account_number.required' => __('Nomor rekening :position wajib diisi.'),
            'bank_accounts.*.account_number.max' => __('Nomor rekening :position maksimal 50 karakter.'),
            'bank_accounts.*.account_name.required' => __('Atas nama rekening :position wajib diisi.'),
            'bank_accounts.*.account_name.max' => __('Atas nama rekening :position maksimal 255 karakter.'),
        ];
    }

    /**
     * Baris rekening yang seluruh isiannya kosong diabaikan (baris baru yang tidak jadi diisi).
     */
    protected function prepareForValidation(): void
    {
        $rekening = collect((array) $this->input('bank_accounts', []))
            ->filter(fn ($baris): bool => is_array($baris))
            ->map(fn (array $baris): array => array_map(
                fn ($nilai): string => trim((string) $nilai),
                array_intersect_key($baris, array_flip(['bank', 'account_number', 'account_name'])) + ['bank' => '', 'account_number' => '', 'account_name' => ''],
            ))
            ->reject(fn (array $baris): bool => implode('', $baris) === '')
            ->values()
            ->all();

        $this->merge([
            'abbreviation' => strtoupper(trim((string) $this->input('abbreviation'))),
            'signature_city' => trim((string) $this->input('signature_city')) ?: null,
            'bank_accounts' => $rekening,
        ]);
    }
}
