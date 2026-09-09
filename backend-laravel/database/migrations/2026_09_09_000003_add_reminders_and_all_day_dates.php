<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('time_zone')->default('Asia/Tokyo');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->date('start_on')->nullable();
            $table->date('end_on')->nullable();
            $table->integer('reminder_minutes')->nullable();
        });

        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('start_at')->nullable()->change();
            $table->timestamp('end_at')->nullable()->change();
        });

        Schema::create('reminder_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->timestamp('occurrence_start_at');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            $table->index('event_id');
            $table->index('user_id');
            $table->unique(['event_id', 'occurrence_start_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminder_deliveries');
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['start_on', 'end_on', 'reminder_minutes']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('time_zone');
        });
    }
};
