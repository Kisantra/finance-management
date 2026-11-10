<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

/** Termin jatuh tempo bawaan, disetel dari form invoice baru (route digate `manage invoice settings`). */
class UpdateDefaultDueDaysRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'days' => ['required', 'integer', 'min:0', 'max:365'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'days.required' => __('Isi termin dalam hari.'),
            'days.integer' => __('Termin harus berupa angka hari.'),
            'days.min' => __('Termin tidak boleh negatif.'),
            'days.max' => __('Termin maksimal 365 hari.'),
        ];
    }
}
