<?php

use App\Http\Controllers\PwaController;
use Illuminate\Support\Facades\Route;

// web ミドルウェアを通さない。マニフェストは Cookie を付けずに取得されるため、通すと取得のたびにセッションが作られる。
Route::prefix('app')->group(function () {
    Route::get('/sw.js', [PwaController::class, 'serviceWorker']);
    Route::get('/manifest.webmanifest', [PwaController::class, 'manifest']);
    Route::get('/offline.html', [PwaController::class, 'offline']);
});
