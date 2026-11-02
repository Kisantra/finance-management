<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReimbursementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'amount' => ['required', 'integer', 'min:1'],
            'expense_date' => ['required', 'date'],
            'category' => ['required', 'string', 'in:transport,meals,office_supplies,communication,accommodation,medical,other'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'action' => ['required', 'in:draft,submit'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.min' => 'Nominal minimal Rp 1.',
            'attachment.mimes' => 'Lampiran harus berupa JPG, PNG, atau PDF.',
            'attachment.max' => 'Ukuran lampiran maksimal 5 MB.',
        ];
    }
}
