<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
  matches.data + match_timelines.data: JSON (=LONGTEXT) → MEDIUMBLOB.
  Veri artık gzip'li binary saklanıyor (GzipJson cast); mevcut düz JSON satırları
  ALTER'da byte'ları bozulmadan taşınır, sıkıştırma matches:compress ile yapılır.
  MEDIUMBLOB (16MB) yeterli: slim maç ~15-75KB, slim timeline ~10-60KB.
*/
return new class extends Migration
{
    public function up(): void
    {
        // SQLite (test ortamı) MODIFY bilmez ve BLOB/TEXT ayrımı yapmaz — atla.
        // (Testler sqlite :memory: kullanır; bu ALTER yalnız canlı MySQL için.)
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }
        DB::statement('ALTER TABLE matches MODIFY data MEDIUMBLOB NOT NULL');
        DB::statement('ALTER TABLE match_timelines MODIFY data MEDIUMBLOB NOT NULL');
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }
        // DİKKAT: gzip'li satırlar varken geri dönme — önce açmak gerekir,
        // yoksa binary veri TEXT kolonda utf8mb4 doğrulamasına takılır.
        DB::statement('ALTER TABLE matches MODIFY data LONGTEXT NOT NULL');
        DB::statement('ALTER TABLE match_timelines MODIFY data LONGTEXT NOT NULL');
    }
};
