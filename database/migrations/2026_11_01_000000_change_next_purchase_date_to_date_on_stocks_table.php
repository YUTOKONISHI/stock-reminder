<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE stocks ALTER COLUMN next_purchase_date TYPE date USING (next_purchase_date AT TIME ZONE 'Asia/Tokyo')::date");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE stocks ALTER COLUMN next_purchase_date TYPE timestamptz USING (next_purchase_date::timestamp AT TIME ZONE 'Asia/Tokyo')");
    }
};
