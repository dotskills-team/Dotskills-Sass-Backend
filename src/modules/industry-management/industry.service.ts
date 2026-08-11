
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateIndustryDto } from './dto/create-industry.dto';
import { IndustryQueryDto } from './dto/industry-query.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';
import { UpdateIndustryStatusDto } from './dto/update-industry-status.dto';

import {
  IndustryStatus,
} from 'src/generated/phase-1-prisma/enums';

import { Prisma } from 'src/generated/phase-1-prisma/client';

@Injectable()
export class IndustryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * CREATE INDUSTRY
   */
  async create(
    dto: CreateIndustryDto,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    const existingIndustry =
      await this.prisma.industry.findFirst({
        where: {
          OR: [
            {
              code,
            },
            {
              name: {
                equals: name,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (existingIndustry) {
      if (existingIndustry.code === code) {
        throw new ConflictException(
          `Industry code "${code}" already exists`,
        );
      }

      throw new ConflictException(
        `Industry name "${name}" already exists`,
      );
    }

    const industry =
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.industry.create({
          data: {
            code,
            name,
            description: dto.description?.trim() || null,
            status: IndustryStatus.ACTIVE,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId ?? null,
            actorType: actorUserId
              ? 'PLATFORM_MEMBER'
              : 'SYSTEM',
            action: 'INDUSTRY_CREATED',
            entityType: 'Industry',
            entityId: created.id,
            requestId: requestId ?? null,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            afterData:
              created as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      });

    return industry;
  }

  /**
   * GET ALL INDUSTRIES
   */
  async findAll(query: IndustryQueryDto) {
    const {
      search,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.IndustryWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search?.trim()) {
      const keyword = search.trim();

      where.OR = [
        {
          code: {
            contains: keyword.toUpperCase(),
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [data, total] =
      await this.prisma.$transaction([
        this.prisma.industry.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            _count: {
              select: {
                companies: true,
              },
            },
          },
        }),

        this.prisma.industry.count({
          where,
        }),
      ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * GET SINGLE INDUSTRY
   */
  async findOne(id: string) {
    const industry =
      await this.prisma.industry.findUnique({
        where: {
          id,
        },
        include: {
          _count: {
            select: {
              companies: true,
            },
          },
        },
      });

    if (!industry) {
      throw new NotFoundException(
        `Industry with ID "${id}" not found`,
      );
    }

    return industry;
  }

  /**
   * UPDATE INDUSTRY
   */
  async update(
    id: string,
    dto: UpdateIndustryDto,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existingIndustry =
      await this.prisma.industry.findUnique({
        where: {
          id,
        },
      });

    if (!existingIndustry) {
      throw new NotFoundException(
        `Industry with ID "${id}" not found`,
      );
    }

    if (
      existingIndustry.status ===
      IndustryStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Archived industry cannot be updated',
      );
    }

    const data: Prisma.IndustryUpdateInput = {};

    if (dto.code !== undefined) {
      data.code = dto.code.trim().toUpperCase();
    }

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      data.description =
        dto.description.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one field is required to update',
      );
    }

    const duplicateConditions: Prisma.IndustryWhereInput[] =
      [];

    if (data.code) {
      duplicateConditions.push({
        code: data.code as string,
      });
    }

    if (data.name) {
      duplicateConditions.push({
        name: {
          equals: data.name as string,
          mode: 'insensitive',
        },
      });
    }

    if (duplicateConditions.length > 0) {
      const duplicate =
        await this.prisma.industry.findFirst({
          where: {
            id: {
              not: id,
            },
            OR: duplicateConditions,
          },
        });

      if (duplicate) {
        if (
          data.code &&
          duplicate.code === data.code
        ) {
          throw new ConflictException(
            `Industry code "${data.code}" already exists`,
          );
        }

        throw new ConflictException(
          `Industry name "${data.name}" already exists`,
        );
      }
    }

    const updatedIndustry =
      await this.prisma.$transaction(async (tx) => {
        const updated =
          await tx.industry.update({
            where: {
              id,
            },
            data,
          });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId ?? null,
            actorType: actorUserId
              ? 'PLATFORM_MEMBER'
              : 'SYSTEM',
            action: 'INDUSTRY_UPDATED',
            entityType: 'Industry',
            entityId: updated.id,
            requestId: requestId ?? null,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            beforeData:
              existingIndustry as unknown as Prisma.InputJsonValue,
            afterData:
              updated as unknown as Prisma.InputJsonValue,
          },
        });

        return updated;
      });

    return updatedIndustry;
  }

  /**
   * ACTIVATE INDUSTRY
   */
  async activate(
    id: string,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.changeStatus(
      id,
      IndustryStatus.ACTIVE,
      actorUserId,
      requestId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * DEACTIVATE INDUSTRY
   */
  async deactivate(
    id: string,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.changeStatus(
      id,
      IndustryStatus.INACTIVE,
      actorUserId,
      requestId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * GENERIC STATUS CHANGE
   */
  async updateStatus(
    id: string,
    dto: UpdateIndustryStatusDto,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.changeStatus(
      id,
      dto.status,
      actorUserId,
      requestId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * INTERNAL STATUS HANDLER
   */
  private async changeStatus(
    id: string,
    status: IndustryStatus,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const industry =
      await this.prisma.industry.findUnique({
        where: {
          id,
        },
        include: {
          _count: {
            select: {
              companies: true,
            },
          },
        },
      });

    if (!industry) {
      throw new NotFoundException(
        `Industry with ID "${id}" not found`,
      );
    }

    if (industry.status === status) {
      throw new BadRequestException(
        `Industry is already ${status.toLowerCase()}`,
      );
    }

    /**
     * ARCHIVED INDUSTRY cannot be
     * activated or deactivated.
     */
    if (
      industry.status === IndustryStatus.ARCHIVED &&
      status !== IndustryStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Archived industry cannot be activated or deactivated',
      );
    }

    /**
     * An archived industry keeps its historical
     * company relationships.
     *
     * However, archived industries must not be
     * assigned to newly created companies.
     */
    const updated =
      await this.prisma.$transaction(async (tx) => {
        const result =
          await tx.industry.update({
            where: {
              id,
            },
            data: {
              status,
            },
          });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId ?? null,
            actorType: actorUserId
              ? 'PLATFORM_MEMBER'
              : 'SYSTEM',
            action: `INDUSTRY_STATUS_CHANGED_TO_${status}`,
            entityType: 'Industry',
            entityId: id,
            requestId: requestId ?? null,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            beforeData: {
              status: industry.status,
            },
            afterData: {
              status: result.status,
            },
            metadata: {
              companyCount:
                industry._count.companies,
            },
          },
        });

        return result;
      });

    return updated;
  }

  /**
   * ARCHIVE INDUSTRY
   *
   * Production-safe replacement for hard delete.
   */
  async archive(
    id: string,
    actorUserId?: string,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.changeStatus(
      id,
      IndustryStatus.ARCHIVED,
      actorUserId,
      requestId,
      ipAddress,
      userAgent,
    );
  }
}






// import {
//   BadRequestException,
//   ConflictException,
//   Injectable,
//   NotFoundException,
// } from '@nestjs/common';

// // import {
// //   Prisma,
// //   PlanStatus,
// // } from '../../generated/phase-1-prisma';

// import { PrismaService } from '../../prisma/prisma.service';

// import { CreateIndustryDto } from './dto/create-industry.dto';
// import { IndustryQueryDto } from './dto/industry-query.dto';
// import { UpdateIndustryDto } from './dto/update-industry.dto';
// import { UpdateIndustryStatusDto } from './dto/update-industry-status.dto';
// import { IndustryStatus, PlanStatus } from 'src/generated/phase-1-prisma/enums';
// import { Prisma } from 'src/generated/phase-1-prisma/client';

// @Injectable()
// export class IndustryService {
//   constructor(
//     private readonly prisma: PrismaService,
//   ) {}

//   /**
//    * CREATE INDUSTRY
//    */
//   async create(
//     dto: CreateIndustryDto,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     const code = dto.code.trim().toUpperCase();
//     const name = dto.name.trim();

//     const existingIndustry = await this.prisma.industry.findFirst({
//       where: {
//         OR: [
//           {
//             code,
//           },
//           {
//             name: {
//               equals: name,
//               mode: 'insensitive',
//             },
//           },
//         ],
//       },
//       select: {
//         id: true,
//         code: true,
//         name: true,
//       },
//     });

//     if (existingIndustry) {
//       if (existingIndustry.code === code) {
//         throw new ConflictException(
//           `Industry code "${code}" already exists`,
//         );
//       }

//       throw new ConflictException(
//         `Industry name "${name}" already exists`,
//       );
//     }

//     const industry = await this.prisma.$transaction(async (tx) => {
//       const created = await tx.industry.create({
//         data: {
//           code,
//           name,
//           description: dto.description?.trim() || null,
//           status: PlanStatus.ACTIVE,
//         },
//       });

//       await tx.auditLog.create({
//         data: {
//           actorUserId: actorUserId ?? null,
//           actorType: actorUserId ? 'PLATFORM_MEMBER' : 'SYSTEM',
//           action: 'INDUSTRY_CREATED',
//           entityType: 'Industry',
//           entityId: created.id,
//           requestId: requestId ?? null,
//           ipAddress: ipAddress ?? null,
//           userAgent: userAgent ?? null,
//           afterData: created as unknown as Prisma.InputJsonValue,
//         },
//       });

//       return created;
//     });

//     return industry;
//   }

//   /**
//    * GET ALL INDUSTRIES
//    */
//   async findAll(query: IndustryQueryDto) {
//     const {
//       search,
//       status,
//       page = 1,
//       limit = 20,
//       sortBy = 'createdAt',
//       sortOrder = 'desc',
//     } = query;

//     const skip = (page - 1) * limit;

//     const where: Prisma.IndustryWhereInput = {};

//     if (status) {
//       where.status = status;
//     }

//     if (search?.trim()) {
//       const keyword = search.trim();

//       where.OR = [
//         {
//           code: {
//             contains: keyword.toUpperCase(),
//             mode: 'insensitive',
//           },
//         },
//         {
//           name: {
//             contains: keyword,
//             mode: 'insensitive',
//           },
//         },
//         {
//           description: {
//             contains: keyword,
//             mode: 'insensitive',
//           },
//         },
//       ];
//     }

//     const [data, total] = await this.prisma.$transaction([
//       this.prisma.industry.findMany({
//         where,
//         skip,
//         take: limit,
//         orderBy: {
//           [sortBy]: sortOrder,
//         },
//         include: {
//           _count: {
//             select: {
//               companies: true,
//             },
//           },
//         },
//       }),

//       this.prisma.industry.count({
//         where,
//       }),
//     ]);

//     const totalPages = Math.ceil(total / limit);

//     return {
//       data,
//       meta: {
//         page,
//         limit,
//         total,
//         totalPages,
//         hasNextPage: page < totalPages,
//         hasPreviousPage: page > 1,
//       },
//     };
//   }

//   /**
//    * GET SINGLE INDUSTRY
//    */
//   async findOne(id: string) {
//     const industry = await this.prisma.industry.findUnique({
//       where: {
//         id,
//       },
//       include: {
//         _count: {
//           select: {
//             companies: true,
//           },
//         },
//       },
//     });

//     if (!industry) {
//       throw new NotFoundException(
//         `Industry with ID "${id}" not found`,
//       );
//     }

//     return industry;
//   }

//   /**
//    * UPDATE INDUSTRY
//    */
//   async update(
//     id: string,
//     dto: UpdateIndustryDto,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     const existingIndustry = await this.prisma.industry.findUnique({
//       where: {
//         id,
//       },
//     });

//     if (!existingIndustry) {
//       throw new NotFoundException(
//         `Industry with ID "${id}" not found`,
//       );
//     }

//     if (existingIndustry.status === IndustryStatus.ARCHIVED) {
//       throw new BadRequestException(
//         'Archived industry cannot be updated',
//       );
//     }

//     const data: Prisma.IndustryUpdateInput = {};

//     if (dto.code !== undefined) {
//       data.code = dto.code.trim().toUpperCase();
//     }

//     if (dto.name !== undefined) {
//       data.name = dto.name.trim();
//     }

//     if (dto.description !== undefined) {
//       data.description = dto.description.trim() || null;
//     }

//     if (Object.keys(data).length === 0) {
//       throw new BadRequestException(
//         'At least one field is required to update',
//       );
//     }

//     const duplicateConditions: Prisma.IndustryWhereInput[] = [];

//     if (data.code) {
//       duplicateConditions.push({
//         code: data.code as string,
//       });
//     }

//     if (data.name) {
//       duplicateConditions.push({
//         name: {
//           equals: data.name as string,
//           mode: 'insensitive',
//         },
//       });
//     }

//     if (duplicateConditions.length > 0) {
//       const duplicate = await this.prisma.industry.findFirst({
//         where: {
//           id: {
//             not: id,
//           },
//           OR: duplicateConditions,
//         },
//       });

//       if (duplicate) {
//         if (
//           data.code &&
//           duplicate.code === data.code
//         ) {
//           throw new ConflictException(
//             `Industry code "${data.code}" already exists`,
//           );
//         }

//         throw new ConflictException(
//           `Industry name "${data.name}" already exists`,
//         );
//       }
//     }

//     const updatedIndustry = await this.prisma.$transaction(
//       async (tx) => {
//         const updated = await tx.industry.update({
//           where: {
//             id,
//           },
//           data,
//         });

//         await tx.auditLog.create({
//           data: {
//             actorUserId: actorUserId ?? null,
//             actorType: actorUserId
//               ? 'PLATFORM_MEMBER'
//               : 'SYSTEM',
//             action: 'INDUSTRY_UPDATED',
//             entityType: 'Industry',
//             entityId: updated.id,
//             requestId: requestId ?? null,
//             ipAddress: ipAddress ?? null,
//             userAgent: userAgent ?? null,
//             beforeData:
//               existingIndustry as unknown as Prisma.InputJsonValue,
//             afterData:
//               updated as unknown as Prisma.InputJsonValue,
//           },
//         });

//         return updated;
//       },
//     );

//     return updatedIndustry;
//   }

//   /**
//    * ACTIVATE INDUSTRY
//    */
//   async activate(
//     id: string,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     return this.changeStatus(
//       id,
//       PlanStatus.ACTIVE,
//       actorUserId,
//       requestId,
//       ipAddress,
//       userAgent,
//     );
//   }

//   /**
//    * DEACTIVATE INDUSTRY
//    */
//   async deactivate(
//     id: string,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     return this.changeStatus(
//       id,
//       PlanStatus.INACTIVE,
//       actorUserId,
//       requestId,
//       ipAddress,
//       userAgent,
//     );
//   }

//   /**
//    * GENERIC STATUS CHANGE
//    */
//   async updateStatus(
//     id: string,
//     dto: UpdateIndustryStatusDto,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     return this.changeStatus(
//       id,
//       dto.status,
//       actorUserId,
//       requestId,
//       ipAddress,
//       userAgent,
//     );
//   }

//   /**
//    * INTERNAL STATUS HANDLER
//    */
//   private async changeStatus(
//     id: string,
//     status: PlanStatus,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     const industry = await this.prisma.industry.findUnique({
//       where: {
//         id,
//       },
//       include: {
//         _count: {
//           select: {
//             companies: true,
//           },
//         },
//       },
//     });

//     if (!industry) {
//       throw new NotFoundException(
//         `Industry with ID "${id}" not found`,
//       );
//     }

//     if (
//       industry.status === status
//     ) {
//       throw new BadRequestException(
//         `Industry is already ${status.toLowerCase()}`,
//       );
//     }

//     /**
//      * ARCHIVED INDUSTRY cannot be activated/deactivated.
//      */
//     if (
//       industry.status === PlanStatus.ARCHIVED &&
//       status !== PlanStatus.ARCHIVED
//     ) {
//       throw new BadRequestException(
//         'Archived industry cannot be activated or deactivated',
//       );
//     }

//     /**
//      * If archiving an industry that has companies,
//      * we allow archive because Company keeps historical
//      * relation through Industry.
//      *
//      * However, an archived industry must not be assignable
//      * to newly created companies.
//      */
//     const updated = await this.prisma.$transaction(
//       async (tx) => {
//         const result = await tx.industry.update({
//           where: {
//             id,
//           },
//           data: {
//             status,
//           },
//         });

//         await tx.auditLog.create({
//           data: {
//             actorUserId: actorUserId ?? null,
//             actorType: actorUserId
//               ? 'PLATFORM_MEMBER'
//               : 'SYSTEM',
//             action: `INDUSTRY_STATUS_CHANGED_TO_${status}`,
//             entityType: 'Industry',
//             entityId: id,
//             requestId: requestId ?? null,
//             ipAddress: ipAddress ?? null,
//             userAgent: userAgent ?? null,
//             beforeData: {
//               status: industry.status,
//             },
//             afterData: {
//               status: result.status,
//             },
//             metadata: {
//               companyCount: industry._count.companies,
//             },
//           },
//         });

//         return result;
//       },
//     );

//     return updated;
//   }

//   /**
//    * ARCHIVE INDUSTRY
//    *
//    * This is the production-safe replacement for hard delete.
//    */
//   async archive(
//     id: string,
//     actorUserId?: string,
//     requestId?: string,
//     ipAddress?: string,
//     userAgent?: string,
//   ) {
//     return this.changeStatus(
//       id,
//       PlanStatus.ARCHIVED,
//       actorUserId,
//       requestId,
//       ipAddress,
//       userAgent,
//     );
//   }
// }