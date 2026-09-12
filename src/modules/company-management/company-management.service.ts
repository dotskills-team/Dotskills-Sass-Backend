import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyStatus,
  IndustryStatus,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

@Injectable()
export class CompanyManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto, createdByUserId: string) {
    const creator = await this.prisma.user.findUnique({
      where: {
        id: createdByUserId,
      },
      select: {
        id: true,
      },
    });

    if (!creator) {
      throw new NotFoundException('Creating user not found');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: dto.tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const industry = await this.prisma.industry.findUnique({
      where: {
        id: dto.industryId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!industry) {
      throw new NotFoundException('Industry not found');
    }

    if (industry.status === IndustryStatus.ARCHIVED) {
      throw new BadRequestException(
        'Archived industry cannot be assigned to a new company',
      );
    }

    const existingCompany = await this.prisma.company.findFirst({
      where: {
        tenantId: dto.tenantId,
        code: dto.code,
      },
      select: {
        id: true,
      },
    });

    if (existingCompany) {
      throw new ConflictException(
        'Company code already exists for this tenant',
      );
    }

    /**
     * Company creation only ever creates the Company row (+ its default
     * CompanySettings) — no Subscription, Billing, Invoice, or Payment is
     * created here. Subscription creation is a separate, explicit
     * Super Admin action taken afterwards (SubscriptionService.create(),
     * via `POST /platform/subscriptions`) — either "Start Trial" (a plan
     * with real trial days) or "Select Paid Plan" (which requires payment
     * before the subscription activates). See buildSubscription()'s own
     * doc comment for how that activation gating works.
     */
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId: dto.tenantId,
          industryId: dto.industryId,
          createdByUserId: creator.id,

          code: dto.code,
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          email: dto.email,
          phone: dto.phone,
          taxId: dto.taxId,
          registrationNo: dto.registrationNo,
          baseCurrencyCode: dto.baseCurrencyCode,
          timezone: dto.timezone,
        },
      });

      /**
       * Business Ops module reads this row from day one (defaults chosen
       * to match the design document's worked examples — most small shops
       * want multi-unit/customer-due/barcode on, variant/combo/multi-
       * location/tax/negative-stock off until the Owner explicitly turns
       * them on). No Owner input needed here — Location creation stays a
       * separate, manual Setup Wizard step (confirmed), but this row must
       * always exist so later guards/services never have to null-check it.
       */
      await tx.companySettings.create({
        data: {
          tenantId: company.tenantId,
          companyId: company.id,
        },
      });

      return company;
    });
  }

  async findAll(query: CompanyQueryDto) {
    const { search, status, industryId, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(status
        ? {
            status: status as any,
          }
        : {}),

      ...(industryId
        ? {
            industryId,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                code: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                legalName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                tradeName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          industry: true,
        },
      }),

      this.prisma.company.count({
        where,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id,
      },
      include: {
        industry: true,

        members: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
            userId: true,
            employeeCode: true,
            designation: true,
            status: true,
            activatedAt: true,
          },
        },

        ownerships: {
          where: {
            endedAt: null,
          },
          select: {
            id: true,
            companyMemberId: true,
            isPrimary: true,
            startedAt: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (dto.industryId) {
      const industry = await this.prisma.industry.findUnique({
        where: {
          id: dto.industryId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!industry) {
        throw new NotFoundException('Industry not found');
      }

      if (industry.status === IndustryStatus.ARCHIVED) {
        throw new BadRequestException(
          'Archived industry cannot be assigned to a company',
        );
      }
    }

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        ...(dto.industryId !== undefined && {
          industryId: dto.industryId,
        }),

        ...(dto.legalName !== undefined && {
          legalName: dto.legalName,
        }),

        ...(dto.tradeName !== undefined && {
          tradeName: dto.tradeName,
        }),

        ...(dto.email !== undefined && {
          email: dto.email,
        }),

        ...(dto.phone !== undefined && {
          phone: dto.phone,
        }),

        ...(dto.taxId !== undefined && {
          taxId: dto.taxId,
        }),

        ...(dto.registrationNo !== undefined && {
          registrationNo: dto.registrationNo,
        }),

        ...(dto.baseCurrencyCode !== undefined && {
          baseCurrencyCode: dto.baseCurrencyCode,
        }),

        ...(dto.timezone !== undefined && {
          timezone: dto.timezone,
        }),
      },
    });
  }

  async updateStatus(id: string, dto: UpdateCompanyStatusDto) {
    const company = await this.prisma.company.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.status === dto.status) {
      return company;
    }

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
    });
  }

  //   async activate(id: string) {
  //     const company =
  //       await this.prisma.company.findUnique({
  //         where: {
  //           id,
  //         },
  //         select: {
  //           id: true,
  //           status: true,
  //         },
  //       });

  //     if (!company) {
  //       throw new NotFoundException(
  //         'Company not found',
  //       );
  //     }

  //     if (company.status === 'CLOSED') {
  //       throw new BadRequestException(
  //         'Closed company cannot be activated',
  //       );
  //     }

  //     // return this.prisma.company.update({
  //     //   where: {
  //     //     id,
  //     //   },
  //     //   data: {
  //     //     status: 'ACTIVE' as any,
  //     //     goLiveAt: new Date(),
  //     //   },
  //     // });
  //     return this.prisma.company.update({
  //   where: { id },
  //   data: {
  //     status: 'LIVE'as any,
  //     goLiveAt: new Date(),
  //   },
  // });
  //   }
  /**
   * A Company only ever goes LIVE as a side effect of a real payment
   * settlement (SubscriptionLifecycleService.transition()) or an explicit
   * complimentary grant (SubscriptionService.buildSubscription()) — never
   * as a standalone Platform-Admin action, since that would let a company
   * skip the mandatory first-payment requirement entirely. This endpoint
   * is kept only as an idempotent "confirm" for a company whose
   * subscription has already earned LIVE status through one of those real
   * paths; it can no longer force LIVE on its own.
   */
  async activate(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.status === CompanyStatus.CLOSED) {
      throw new BadRequestException('Closed company cannot be activated');
    }

    if (company.status === CompanyStatus.LIVE) {
      return company;
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        companyId: id,
        status: { in: ['ACTIVE'] },
      },
      select: { id: true },
    });

    if (!activeSubscription) {
      throw new BadRequestException(
        'Company cannot go LIVE until its first subscription payment succeeds (or a complimentary subscription is granted).',
      );
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.LIVE,
        goLiveAt: new Date(),
      },
    });
  }
  // async suspend(id: string) {
  //   const company =
  //     await this.prisma.company.findUnique({
  //       where: {
  //         id,
  //       },
  //       select: {
  //         id: true,
  //         status: true,
  //       },
  //     });

  //   if (!company) {
  //     throw new NotFoundException(
  //       'Company not found',
  //     );
  //   }

  //   if (company.status === 'CLOSED') {
  //     throw new BadRequestException(
  //       'Closed company cannot be suspended',
  //     );
  //   }

  //   return this.prisma.company.update({
  //     where: {
  //       id,
  //     },
  //     data: {
  //       status: 'SUSPENDED' as any,
  //     },
  //   });
  // }
  async suspend(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.status === CompanyStatus.CLOSED) {
      throw new BadRequestException('Closed company cannot be suspended');
    }

    if (company.status === CompanyStatus.SUSPENDED) {
      return company;
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.SUSPENDED,
      },
    });
  }
}
