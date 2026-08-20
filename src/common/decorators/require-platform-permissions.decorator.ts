import { SetMetadata } from '@nestjs/common';
import type { PlatformPermissionCode } from '../constants/permission.constants';

export const PLATFORM_PERMISSIONS_KEY = 'dotskills:platform-permissions';

export const RequirePlatformPermissions = (
  ...permissions: PlatformPermissionCode[]
) => SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);
