import { SetMetadata } from "@nestjs/common";
import type { CompanyPermissionCode } from "../constants/permission.constants";

export const COMPANY_PERMISSIONS_KEY = "dotskills:company-permissions";

export const RequireCompanyPermissions = (
  ...permissions: CompanyPermissionCode[]
) => SetMetadata(COMPANY_PERMISSIONS_KEY, permissions);
