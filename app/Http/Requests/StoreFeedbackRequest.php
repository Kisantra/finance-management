<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'type' => ['required', 'in:bug,feature,feedback'],
            'priority' => ['required', 'in:low,medium,high,critical'],
            'page_url' => ['nullable', 'string', 'max:2000'],
            // Konteks untuk tim IT di Watchpost: trace & kode dari halaman error,
            // jejak langkah dari skrip browser Watchpost (window.Watchpost.trail()).
            'trace_id' => ['nullable', 'uuid'],
            'error_id' => ['nullable', 'string', 'regex:/^ERR-[A-Z0-9]{10}$/'],
            'breadcrumbs' => ['nullable', 'array', 'max:50'],
            'breadcrumbs.*.type' => ['required', 'string', 'in:page,click,submit,request'],
            'breadcrumbs.*.label' => ['required', 'string', 'max:200'],
            'breadcrumbs.*.at' => ['required', 'date'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf'],
        ];
    }
}
