<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RespondFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'response' => ['required', 'string', 'max:5000'],
            // Bug yang sudah diteruskan: statusnya mengikuti tiket Watchpost, jadi tidak diisi di sini.
            'status' => [Rule::requiredIf(fn () => ! $this->route('feedback')?->statusIkutWatchpost()), 'nullable', 'in:in_progress,resolved,closed'],
        ];
    }
}
