<?php

use App\Models\User;
use Illuminate\Support\Facades\Schedule;

Schedule::command('app:send-purchase-reminders')->dailyAt('09:00')->timezone('Asia/Tokyo')->onOneServer();
Schedule::command('app:backup-database')->dailyAt('04:00')->timezone('Asia/Tokyo')->onOneServer();
Schedule::command('model:prune', ['--model' => User::class])->dailyAt('03:00')->timezone('Asia/Tokyo')->onOneServer();
