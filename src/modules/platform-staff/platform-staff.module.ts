import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PlatformPermissionsGuard } from "../../common/guards/platform-permissions.guard";
import { PlatformStaffController } from "./platform-staff.controller";
import { PlatformStaffService } from "./platform-staff.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlatformStaffController],
  providers: [PlatformStaffService, PlatformPermissionsGuard],
  exports: [PlatformStaffService],
})
export class PlatformStaffModule {}
