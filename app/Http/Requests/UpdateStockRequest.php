<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateStockRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1'],
            'consumption_interval_days' => ['required', 'integer', 'min:1'],
            'next_purchase_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
