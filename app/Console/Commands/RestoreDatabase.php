<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class RestoreDatabase extends Command
{
    protected $signature = 'app:restore-database
        {file? : db/ の下のファイル名（例: 20261025-040000.dump）。省くと一覧を出す}
        {--database= : 復元先のデータベース。省くと接続中のデータベース}
        {--force : 確認を省く}';

    protected $description = 'バックアップ用のディスクにあるダンプから DB を復元する';

    public function handle(): int
    {
        $disk = Storage::disk('backup');
        /** @var string|null $file */
        $file = $this->argument('file');

        if ($file === null) {
            foreach ($disk->files('db') as $path) {
                $this->line(basename($path));
            }

            return self::SUCCESS;
        }

        if (! $disk->exists("db/{$file}")) {
            $this->error("db/{$file} がありません。");

            return self::FAILURE;
        }

        /** @var array{host: string, port: string|int, database: string, username: string, password: string} $db */
        $db = config('database.connections.pgsql');
        /** @var string|null $database */
        $database = $this->option('database');
        $target = $database ?? $db['database'];

        if (! $this->option('force') && ! $this->confirm("データベース「{$target}」の中身を db/{$file} で置き換えます。続けますか")) {
            return self::FAILURE;
        }

        $local = storage_path("app/restore-{$file}");

        try {
            $stream = $disk->readStream("db/{$file}");
            file_put_contents($local, $stream);

            // --clean で既存のテーブルを消してから作り直す。--single-transaction なので、途中で失敗すれば元のまま残る。
            Process::env(['PGPASSWORD' => $db['password']])
                ->timeout(600)
                ->run([
                    'pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction',
                    "--host={$db['host']}", "--port={$db['port']}",
                    "--username={$db['username']}", "--dbname={$target}",
                    $local,
                ])
                ->throw();
        } finally {
            if (file_exists($local)) {
                unlink($local);
            }
        }

        $this->info("db/{$file} を「{$target}」に復元しました。");

        return self::SUCCESS;
    }
}
