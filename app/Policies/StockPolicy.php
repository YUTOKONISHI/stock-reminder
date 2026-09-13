<?php

namespace App\Policies;

use App\Models\Stock;
use App\Models\User;

class StockPolicy
{
    public function view(User $user, Stock $stock): bool
    {
        return $stock->user_id === $user->id;
    }

    public function update(User $user, Stock $stock): bool
    {
        return $stock->user_id === $user->id;
    }

    public function delete(User $user, Stock $stock): bool
    {
        return $stock->user_id === $user->id;
    }

    public function purchase(User $user, Stock $stock): bool
    {
        return $stock->user_id === $user->id;
    }
}
