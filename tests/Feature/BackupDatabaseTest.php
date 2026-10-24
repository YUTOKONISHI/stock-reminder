<?php

use Carbon\Carbon;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

use function Pest\Laravel\artisan;
use function Pest\Laravel\travelTo;

beforeEach(function () {
    travelTo(Carbon::parse('2026-10-25 04:00:00'));
    Storage::fake('backup');
});

/** pg_dump の代わりに、--file で指定された場所へ中身を書く。 */
function fakeDump(): void
{
    Process::fake(function (PendingProcess $process) {
        /** @var list<string> $command */
        $command = $process->command;
        $file = Str::after(collect($command)->first(fn (string $arg) => str_starts_with($arg, '--file=')), '--file=');
        file_put_contents($file, 'dump');

        return Process::result();
    });
}

describe('バックアップ', function () {
    it('pg_dump の出力を日時の名前で送り、手元のファイルは消す', function () {
        fakeDump();

        artisan('app:backup-database')->assertSuccessful();

        Storage::disk('backup')->assertExists('db/20261025-040000.dump');
        expect(Storage::disk('backup')->get('db/20261025-040000.dump'))->toBe('dump');
        expect(file_exists(storage_path('app/20261025-040000.dump')))->toBeFalse();
        Process::assertRan(fn (PendingProcess $process) => $process->command[0] === 'pg_dump'
            && isset($process->environment['PGPASSWORD']));
    });

    it('pg_dump が失敗すれば送らない', function () {
        Process::fake(['*' => Process::result(exitCode: 1, errorOutput: 'connection refused')]);

        expect(fn () => artisan('app:backup-database')->run())->toThrow(Exception::class);

        expect(Storage::disk('backup')->files('db'))->toBe([]);
    });

    it('30日より古いものを消し、それ以外は残す', function () {
        fakeDump();
        $disk = Storage::disk('backup');
        $disk->put('db/old.dump', 'old');
        $disk->put('db/recent.dump', 'recent');
        touch($disk->path('db/old.dump'), Carbon::parse('2026-09-24 03:00:00')->getTimestamp());
        touch($disk->path('db/recent.dump'), Carbon::parse('2026-09-26 04:00:00')->getTimestamp());

        artisan('app:backup-database')->assertSuccessful();

        $disk->assertMissing('db/old.dump');
        $disk->assertExists('db/recent.dump');
    });
});

describe('復元', function () {
    it('ファイルを省くと一覧を出す', function () {
        Storage::disk('backup')->put('db/20261024-040000.dump', 'dump');

        artisan('app:restore-database')
            ->expectsOutput('20261024-040000.dump')
            ->assertSuccessful();
    });

    it('無いファイルは復元しない', function () {
        Process::fake();

        artisan('app:restore-database', ['file' => 'missing.dump', '--force' => true])->assertFailed();

        Process::assertNothingRan();
    });

    it('確認で断れば復元しない', function () {
        Process::fake();
        Storage::disk('backup')->put('db/20261024-040000.dump', 'dump');

        artisan('app:restore-database', ['file' => '20261024-040000.dump'])
            ->expectsConfirmation('データベース「testing」の中身を db/20261024-040000.dump で置き換えます。続けますか', 'no')
            ->assertFailed();

        Process::assertNothingRan();
    });

    it('指定したデータベースへ pg_restore で戻す', function () {
        Process::fake();
        Storage::disk('backup')->put('db/20261024-040000.dump', 'dump');

        artisan('app:restore-database', ['file' => '20261024-040000.dump', '--database' => 'scratch', '--force' => true])
            ->assertSuccessful();

        Process::assertRan(fn (PendingProcess $process) => $process->command[0] === 'pg_restore'
            && in_array('--dbname=scratch', $process->command, true));
    });
});
