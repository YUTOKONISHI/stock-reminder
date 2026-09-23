<?php

use App\Models\User;
use Illuminate\Log\Logger;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\TestHandler;
use Monolog\Logger as Monolog;
use Monolog\LogRecord;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

function captureRequestLog(): TestHandler
{
    $handler = new TestHandler;

    /** @var Logger $logger */
    $logger = Log::channel('request');

    /** @var Monolog $monolog */
    $monolog = $logger->getLogger();
    $monolog->setHandlers([$handler]);

    return $handler;
}

/** 捕まえた1件目のログの付加情報を返す。 */
function firstLogContext(TestHandler $handler): array
{
    /** @var LogRecord $record */
    $record = $handler->getRecords()[0];

    return $record->context;
}

describe('記録する内容', function () {
    it('メソッド、パス、ステータス、IPを残す', function () {
        $handler = captureRequestLog();

        get('/app/login');

        expect(firstLogContext($handler))
            ->method->toBe('GET')
            ->path->toBe('/app/login')
            ->status->toBe(200)
            ->ip->toBe('127.0.0.1');
    });

    it('ログイン中なら利用者のIDとガードを残す', function () {
        $user = User::factory()->create();
        $handler = captureRequestLog();

        actingAs($user)->get(route('dashboard'));

        expect(firstLogContext($handler))
            ->user_id->toBe($user->id)
            ->guard->toBe('web');
    });

    it('未ログインならIDとガードはnullになる', function () {
        $handler = captureRequestLog();

        get('/app/login');

        expect(firstLogContext($handler))
            ->user_id->toBeNull()
            ->guard->toBeNull();
    });
});

describe('マスク', function () {
    it('パスワードやメールを伏せる', function () {
        $handler = captureRequestLog();

        post(route('login.store'), [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        expect(firstLogContext($handler)['input'])->toBe([
            'email' => '[FILTERED]',
            'password' => '[FILTERED]',
        ]);
    });

    it('入れ子の中も伏せる', function () {
        $handler = captureRequestLog();

        post(route('register.store'), [
            'name' => 'test',
            'profile' => [
                'password' => 'password',
                'nickname' => 'たろう',
            ],
        ]);

        expect(firstLogContext($handler)['input'])->toBe([
            'name' => 'test',
            'profile' => [
                'password' => '[FILTERED]',
                'nickname' => 'たろう',
            ],
        ]);
    });

    it('伏せる対象でない値はそのまま残す', function () {
        $handler = captureRequestLog();

        post(route('register.store'), ['name' => 'test']);

        expect(firstLogContext($handler)['input'])->toBe(['name' => 'test']);
    });
});

describe('除外するパス', function () {
    it('ヘルスチェックは記録しない', function () {
        $handler = captureRequestLog();

        get('/up');

        expect($handler->getRecords())->toBeEmpty();
    });

    it('Boost の経路は記録しない', function () {
        $handler = captureRequestLog();

        get('/_boost/anything');

        expect($handler->getRecords())->toBeEmpty();
    });
});

describe('ログレベル', function () {
    it('ステータスに応じて情報、警告、エラーを使い分ける', function (int $status, string $level) {
        Route::get('/__status', fn () => response('', $status));

        $handler = captureRequestLog();

        get('/__status');

        expect($handler->getRecords()[0]->level->toPsrLogLevel())->toBe($level);
    })->with([
        '200は情報' => [200, 'info'],
        '404は警告' => [404, 'warning'],
        '500はエラー' => [500, 'error'],
    ]);
});
