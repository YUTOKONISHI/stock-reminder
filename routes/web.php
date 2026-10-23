<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationLogController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/app/welcome');

Route::prefix('app')->group(function () {
    Route::redirect('/', '/app/dashboard');

    Route::inertia('/welcome', 'welcome')->name('welcome');

    Route::inertia('/forgot-password', 'auth/forgot-password')->name('forgot-password');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendTemporaryPassword'])->middleware('throttle:6,1')->name('forgot-password.store');
    Route::inertia('/reset-password', 'auth/reset-password')->name('reset-password');
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:6,1')->name('reset-password.store');

    Route::middleware('auth')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

        Route::get('/stocks', [StockController::class, 'index'])->name('stocks.index');
        Route::get('/stocks/create', [StockController::class, 'create'])->name('stocks.create');
        Route::get('/stocks/{stock}/edit', [StockController::class, 'edit'])->name('stocks.edit');
        Route::post('/stocks', [StockController::class, 'store'])->name('stocks.store');
        Route::put('/stocks/{stock}', [StockController::class, 'update'])->name('stocks.update');
        Route::delete('/stocks/{stock}', [StockController::class, 'destroy'])->name('stocks.destroy');
        Route::patch('/stocks/{stock}/purchase', [StockController::class, 'purchase'])->name('stocks.purchase');

        Route::get('/notifications', [NotificationLogController::class, 'index'])->name('notifications.index');
        Route::patch('/notifications/{notificationLog}/read', [NotificationLogController::class, 'markAsRead'])->name('notifications.read');
        Route::patch('/notifications/{notificationLog}/unread', [NotificationLogController::class, 'markAsUnread'])->name('notifications.unread');

        Route::inertia('/settings', 'settings/index')->name('settings.index');
        Route::get('/settings/profile', [ProfileController::class, 'index'])->name('profile.edit');
        Route::put('/settings/profile', [ProfileController::class, 'update'])->name('profile.update');

        Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->name('push-subscriptions.store');
        Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->name('push-subscriptions.destroy');
    });
});

Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:admin-login')->name('login.store');

    Route::middleware('auth:admin')->group(function () {
        Route::get('/dashboard', [ProductController::class, 'index'])->name('dashboard');
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
        Route::post('/password', [AuthController::class, 'updateAdminPassword'])->name('admin-password');

        Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
        Route::put('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

        Route::post('/products', [ProductController::class, 'store'])->name('products.store');
        Route::put('/products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('/products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    });
});
