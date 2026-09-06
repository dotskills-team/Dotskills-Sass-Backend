import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/phase-1-prisma/client';

const databaseUrl = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: databaseUrl! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const notifications = await prisma.notification.findMany({
    where: { type: { in: ['OUT_OF_STOCK', 'LOW_STOCK'] } },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Total stock notifications found:', notifications.length);

  for (const n of notifications) {
    console.log('\n--- Notification', n.id, n.type, '---');
    console.log('createdAt:', n.createdAt.toISOString());
    console.log('metadata:', n.metadata);

    const currentInventory = await prisma.inventory.findFirst({
      where: {
        companyId: n.companyId,
        productId: n.relatedEntityId,
        locationId: n.locationId ?? undefined,
      },
      select: { quantity: true, updatedAt: true },
    });
    console.log('CURRENT Inventory.quantity (now):', currentInventory?.quantity.toString(), 'updatedAt:', currentInventory?.updatedAt);

    // Find the StockMovement closest to this notification's createdAt for the same product/location
    const movementsAround = await prisma.stockMovement.findMany({
      where: {
        companyId: n.companyId,
        productId: n.relatedEntityId,
        locationId: n.locationId ?? undefined,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, changeQty: true, balanceAfter: true, movementType: true },
    });
    console.log('All StockMovement rows for this product/location, in order:');
    for (const m of movementsAround) {
      console.log(
        ' ',
        m.createdAt.toISOString(),
        m.movementType,
        'changeQty=', m.changeQty.toString(),
        'balanceAfter=', m.balanceAfter.toString(),
      );
    }
  }

  await prisma.$disconnect();
}
main();
