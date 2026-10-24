<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class BackupDatabase extends Command
{
    private const RETENTION_DAYS = 30;

    protected $signature = 'app:backup-database';

    protected $description = 'DB のダンプを取ってバックアップ用のディスクに送り、保持期間を過ぎたものを消す';

    public function handle(): int
    {
        /** @var array{host: string, port: string|int, database: string, username: string, password: string} $db */
        $db = config('database.connections.pgsql');
        $name = now()->format('Ymd-His').'.dump';
        $local = storage_path("app/{$name}");
        $disk = Storage::disk('backup');

        try {
            Process::env(['PGPASSWORD' => $db['password']])
                ->timeout(600)
                ->run([
                    'pg_dump', '--format=custom', '--no-owner', '--no-privileges',
                    "--host={$db['host']}", "--port={$db['port']}",
                    "--username={$db['username']}", "--dbname={$db['database']}",
                    "--file={$local}",
                ])
                ->throw();

            $disk->putFileAs('db', new File($local), $name);
        } finally {
            if (file_exists($local)) {
                unlink($local);
            }
        }

        $threshold = now()->subDays(self::RETENTION_DAYS)->getTimestamp();
        $pruned = 0;

        foreach ($disk->files('db') as $file) {
            if ($disk->lastModified($file) < $threshold) {
                $disk->delete($file);
                $pruned++;
            }
        }

        Log::info('database backup', ['file' => "db/{$name}", 'pruned' => $pruned]);
        $this->info("db/{$name} を送りました。古いものを{$pruned}件消しました。");

        return self::SUCCESS;
    }
}
