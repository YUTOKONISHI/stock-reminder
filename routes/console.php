<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('app:send-purchase-reminders')->dailyAt('09:00')->timezone('Asia/Tokyo')->onOneServer();
Schedule::command('app:backup-database')->dailyAt('04:00')->timezone('Asia/Tokyo')->onOneServer();
