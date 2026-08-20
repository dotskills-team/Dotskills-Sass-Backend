import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, this.requestMetadata(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto, this.requestMetadata(request));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, user: await this.authService.getCurrentUser(user) };
  }

  @Get('me/companies')
  @UseGuards(JwtAuthGuard)
  async myCompanies(@CurrentUser() user: AuthenticatedUser) {
    const companies = await this.authService.getMyCompanies(user.userId);
    return { success: true, companies };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.userId, user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId);
  }

  private requestMetadata(request: Request) {
    return {
      ipAddress: request.ip || undefined,
      userAgent: request.get('user-agent')?.slice(0, 2000),
    };
  }

  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  staffLogin(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.staffLogin(dto, this.requestMetadata(request));
  }
}
