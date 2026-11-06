<?php

namespace App\Http\Requests;

class UpdateFeedbackRequest extends StoreFeedbackRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        // Konteks halaman & lampiran milik saat laporan dikirim, bukan bahan edit.
        foreach (['page_url', 'attachment', 'trace_id', 'error_id', 'breadcrumbs', 'breadcrumbs.*.type', 'breadcrumbs.*.label', 'breadcrumbs.*.at'] as $field) {
            unset($rules[$field]);
        }

        return $rules;
    }
}
