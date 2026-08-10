import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AccessControlSetupController } from "./access-control-setup.controller";
import { AccessControlSetupService } from "./access-control-setup.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccessControlSetupController],
  providers: [AccessControlSetupService],
})
export class AccessControlSetupModule {}
