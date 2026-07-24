<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin hesap yönetimi — yalnız süper admin erişir ('admin.super' middleware).
 */
class AdminUserController extends Controller
{
    /**
     * GET /api/v1/admin/admins — hesap listesi.
     */
    public function index(): JsonResponse
    {
        $admins = AdminUser::orderBy('id')->get()->map(fn (AdminUser $u) => [
            'id'             => $u->id,
            'username'       => $u->username,
            'role'           => $u->role,
            'created_at'     => $u->created_at,
            'last_active_at' => $u->tokens()->max('last_used_at'),
            'online'         => $u->tokens()->where('expires_at', '>', now())->exists(),
        ]);

        return response()->json(['admins' => $admins]);
    }

    /**
     * POST /api/v1/admin/admins — yeni admin hesabı (rol her zaman 'admin').
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string|min:3|max:30|alpha_dash|unique:admin_users,username',
            'password' => 'required|string|min:8|max:100',
        ]);

        $user = AdminUser::create([
            'username' => $data['username'],
            'password' => $data['password'],
            'role'     => 'admin',
        ]);

        return response()->json(['ok' => true, 'id' => $user->id], 201);
    }

    /**
     * DELETE /api/v1/admin/admins/{id} — hesabı ve oturumlarını sil.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $target = AdminUser::findOrFail($id);

        if ($target->id === $request->user()->id) {
            return response()->json(['error' => 'Kendi hesabını silemezsin.'], 422);
        }
        if ($target->role === 'super_admin') {
            return response()->json(['error' => 'Süper admin hesabı silinemez.'], 422);
        }

        $target->tokens()->delete();
        $target->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * PUT /api/v1/admin/admins/{id}/password — şifre sıfırla, oturumlarını düşür.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $target = AdminUser::findOrFail($id);

        // Süper adminin şifresini yalnız kendisi değiştirebilir
        if ($target->role === 'super_admin' && $target->id !== $request->user()->id) {
            return response()->json(['error' => 'Süper adminin şifresi buradan değiştirilemez.'], 422);
        }

        $data = $request->validate([
            'password' => 'required|string|min:8|max:100',
        ]);

        $target->password = $data['password'];
        $target->save();
        $target->tokens()->delete(); // eski şifreyle açık oturum kalmasın

        return response()->json(['ok' => true]);
    }
}
