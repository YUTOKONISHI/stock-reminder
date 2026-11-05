<?php

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Support\Facades\Schedule;

Schedule::command('app:send-purchase-reminders')->hourly()->between('9:00', '12:00')->timezone('Asia/Tokyo')->onOneServer();
Schedule::command('app:backup-database')->dailyAt('04:00')->timezone('Asia/Tokyo')->onOneServer();
Schedule::command('model:prune', ['--model' => [User::class, NotificationLog::class]])->dailyAt('03:00')->timezone('Asia/Tokyo')->onOneServer();
