import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../types/authenticated-user.type";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return field ? request.user[field] : request.user;
  },
);
