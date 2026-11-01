<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('products')->ignore($this->route('product'))],
            'category_id' => ['required', 'exists:categories,id'],
            'default_consumption_interval_days' => ['required', 'integer', 'min:1'],
        ];
    }
}
