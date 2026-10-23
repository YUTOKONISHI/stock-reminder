<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PwaController extends Controller
{
    public function serviceWorker(): BinaryFileResponse
    {
        return $this->file('sw.js', 'text/javascript; charset=UTF-8');
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
