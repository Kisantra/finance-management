<?php

namespace App\Http\Requests\Admin;

class UpdateUserRequest extends StoreUserRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['email'] = ['required', 'string', 'email', 'max:255', "unique:mysql.users,email,{$this->route('user')->id}"];
        $rules['password'] = ['nullable', 'string', 'min:8', 'confirmed'];

        return $rules;
    }
}
