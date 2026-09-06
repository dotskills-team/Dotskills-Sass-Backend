import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';

/**
 * @Global() so any future feature needing cloud object storage (not just
 * Company logos) can inject StorageService directly, same precedent as
 * NotificationModule/LocationAccessModule.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
