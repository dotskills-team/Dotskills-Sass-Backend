import { Global, Module } from '@nestjs/common';

import { CompanyPermissionResolverService } from './company-permission-resolver.service';
import { LocationAccessService } from './location-access.service';

/**
 * @Global(), same as PrismaModule — these 2 services are needed by nearly
 * every Location-touching business-ops module (Sale, Purchase Order,
 * Stock Transfer, Cash Drawer, Stock Adjustment, Reporting); registering
 * them once here avoids repeating `imports: [LocationAccessModule]` in
 * every one of those module files.
 */
@Global()
@Module({
  providers: [CompanyPermissionResolverService, LocationAccessService],
  exports: [CompanyPermissionResolverService, LocationAccessService],
})
export class LocationAccessModule {}
