<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UnreadNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ];
    }
}
