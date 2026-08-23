import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/phase-1-prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const latestPayment = await prisma.payment.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          currencyCode: true,
          billing: {
            select: {
              id: true,
              status: true,
              amount: true,
              attemptCount: true,
              attempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 3,
                select: { attemptNumber: true, status: true, failureCode: true, failureMessage: true, attemptedAt: true, completedAt: true },
              },
            },
          },
          subscription: { select: { id: true, status: true } },
        },
      },
    },
  });

  console.log('=== LATEST PAYMENT ===');
  console.log(
    JSON.stringify(
      latestPayment && {
        id: latestPayment.id,
        status: latestPayment.status,
        amount: latestPayment.amount,
        currencyCode: latestPayment.currencyCode,
        providerTransactionId: latestPayment.providerTransactionId,
        gatewayReference: latestPayment.gatewayReference,
        failureReason: latestPayment.failureReason,
        initiatedAt: latestPayment.initiatedAt,
        succeededAt: latestPayment.succeededAt,
        failedAt: latestPayment.failedAt,
        createdAt: latestPayment.createdAt,
        updatedAt: latestPayment.updatedAt,
      },
      null,
      2,
    ),
  );

  console.log('=== RELATED INVOICE / BILLING / BILLINGATTEMPTS / SUBSCRIPTION ===');
  console.log(JSON.stringify(latestPayment?.invoice, null, 2));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
