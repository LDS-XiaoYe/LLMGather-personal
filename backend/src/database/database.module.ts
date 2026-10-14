import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { SystemSettingsService } from '../common/system-settings.service';

@Global()
@Module({
  // Async providers gate dependent modules AND main.ts settings reads before app.listen().
  providers: [
    { provide: DatabaseService, useFactory: async () => {
      const db = new DatabaseService();
      await db.initialize();
      return db;
    } },
    { provide: SystemSettingsService, inject: [DatabaseService], useFactory: async (db: DatabaseService) => {
      const settings = new SystemSettingsService(db);
      await settings.initialize();
      return settings;
    } },
  ],
  exports: [DatabaseService, SystemSettingsService],
})
export class DatabaseModule {}
