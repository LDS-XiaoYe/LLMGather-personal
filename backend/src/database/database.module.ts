import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { SystemSettingsService } from '../common/system-settings.service';

@Global()
@Module({
  providers: [DatabaseService, SystemSettingsService],
  exports: [DatabaseService, SystemSettingsService],
})
export class DatabaseModule {}
