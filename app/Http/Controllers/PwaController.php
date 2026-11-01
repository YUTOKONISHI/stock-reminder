<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PwaController extends Controller
{
    public function serviceWorker(): Response
    {
        // ビルドかオフライン画面が変わると sw.js の中身も変わり、ブラウザが更新を検知する。
        $version = md5(Vite::manifestHash().File::hash(resource_path('pwa/offline.html')));
        $script = str_replace('__SW_VERSION__', $version, File::get(resource_path('pwa/sw.js')));

        return response($script, 200, ['Content-Type' => 'text/javascript; charset=UTF-8']);
    }

    public function manifest(): BinaryFileResponse
    {
        return $this->file('manifest.webmanifest', 'application/manifest+json');
    }

    public function offline(): BinaryFileResponse
    {
        return $this->file('offline.html', 'text/html; charset=UTF-8');
    }

    private function file(string $name, string $contentType): BinaryFileResponse
    {
        return response()->file(resource_path('pwa/'.$name), ['Content-Type' => $contentType]);
    }
}
