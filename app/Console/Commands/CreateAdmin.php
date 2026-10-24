<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin {name=admin}';

    protected $description = '管理者を作る。パスワードは入力を伏せて受け取る';

    public function handle(): int
    {
        /** @var string $name */
        $name = $this->argument('name');

        $validator = Validator::make(
            [
                'name' => $name,
                'password' => (string) $this->secret('パスワード'),
                'password_confirmation' => (string) $this->secret('パスワード（確認）'),
            ],
            [
                'name' => ['required', 'string', 'max:255', 'unique:admin,name'],
                'password' => ['required', 'string', Password::default(), 'confirmed'],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        Admin::create(['name' => $name, 'password' => $validator->validated()['password']]);
        $this->info("管理者「{$name}」を作りました。");

        return self::SUCCESS;
    }
}
