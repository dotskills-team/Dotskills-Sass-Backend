

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

@Injectable()
export class CompanyManagementService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    dto: CreateCompanyDto,
    createdByUserId: string,
  ) {
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
      },
    });

    if (!industry) {
      throw new NotFoundException('Industry not found');
    }

    const existingCompany =
      await this.prisma.company.findFirst({
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

    return this.prisma.company.create({
      data: {
        tenantId: dto.tenantId,
        industryId: dto.industryId,
        createdByUserId,
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
  }

  async findAll(query: CompanyQueryDto) {
    const {
      search,
      status,
      industryId,
      page = 1,
      limit = 20,
    } = query;

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

    const [items, total] =
      await this.prisma.$transaction([
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
    const company =
      await this.prisma.company.findUnique({
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
      throw new NotFoundException(
        'Company not found',
      );
    }

    return company;
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
  ) {
    const company =
      await this.prisma.company.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    if (dto.industryId) {
      const industry =
        await this.prisma.industry.findUnique({
          where: {
            id: dto.industryId,
          },
          select: {
            id: true,
          },
        });

      if (!industry) {
        throw new NotFoundException(
          'Industry not found',
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
          baseCurrencyCode:
            dto.baseCurrencyCode,
        }),

        ...(dto.timezone !== undefined && {
          timezone: dto.timezone,
        }),
      },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateCompanyStatusDto,
  ) {
    const company =
      await this.prisma.company.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    if (company.status === dto.status) {
      return company;
    }

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        status: dto.status as any,
      },
    });
  }

  async activate(id: string) {
    const company =
      await this.prisma.company.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    if (company.status === 'CLOSED') {
      throw new BadRequestException(
        'Closed company cannot be activated',
      );
    }

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        status: 'ACTIVE' as any,
        goLiveAt: new Date(),
      },
    });
  }

  async suspend(id: string) {
    const company =
      await this.prisma.company.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    if (company.status === 'CLOSED') {
      throw new BadRequestException(
        'Closed company cannot be suspended',
      );
    }

    return this.prisma.company.update({
      where: {
        id,
      },
      data: {
        status: 'SUSPENDED' as any,
      },
    });
  }
}