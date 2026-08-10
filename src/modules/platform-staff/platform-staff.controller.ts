import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PLATFORM_PERMISSIONS } from "../../common/constants/permission.constants";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePlatformPermissions } from "../../common/decorators/require-platform-permissions.decorator";
import { PlatformPermissionsGuard } from "../../common/guards/platform-permissions.guard";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreatePlatformStaffDto,
  PlatformStaffListQueryDto,
  ReplacePlatformRolesDto,
  UpdatePlatformStaffDto,
  UpdatePlatformStaffStatusDto,
} from "./dto/platform-staff.dto";
import { PlatformStaffService } from "./platform-staff.service";

@Controller("platform/staff")
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformStaffController {
  constructor(private readonly service: PlatformStaffService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_READ)
  list(@Query() query: PlatformStaffListQueryDto) {
    return this.service.list(query);
  }

  @Get(":id")
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_READ)
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_CREATE)
  create(
    @Body() dto: CreatePlatformStaffDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(dto, actor);
  }

  @Patch(":id")
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_UPDATE)
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePlatformStaffDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Put(":id/roles")
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN)
  replaceRoles(
    @Param("id") id: string,
    @Body() dto: ReplacePlatformRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceRoles(id, dto, actor);
  }

  @Patch(":id/status")
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.STAFF_STATUS)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdatePlatformStaffStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto, actor);
  }
}
