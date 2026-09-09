<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('start_at');
            $table->timestamp('end_at');
            $table->boolean('all_day')->default(false);
            $table->text('recurrence_rule')->nullable();
            $table->timestamps();
            $table->index('user_id');
            $table->index(['user_id', 'start_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
