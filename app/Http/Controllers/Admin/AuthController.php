<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function showLogin(): Response
    {
        return Inertia::render('admin/login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'name' => ['required'],
            'password' => ['required'],
        ]);

        if (Auth::guard('admin')->attempt($credentials)) {
            $request->session()->regenerate();

            return to_route('admin.dashboard');
        }

        return back()->withErrors([
            'auth_error' => '名前またはパスワードが正しくありません',
        ]);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('admin.login');
    }

    public function updateAdminPassword(Request $request): RedirectResponse
    {
        $request->validate([
            'current_password' => ['required', 'string', 'current_password:admin'],
            'password' => ['required', 'string', Password::default(), 'confirmed'],
        ], [
            'current_password.current_password' => '現在のパスワードが違います。',
        ]);

        /** @var Admin $admin */
        $admin = Auth::guard('admin')->user();

        // パスワードはModel側でHash化されるので、ここではそのまま渡す
        $admin->update([
            'password' => $request->password,
        ]);

        return back()->with('success', 'パスワードを変更しました');
    }
}
