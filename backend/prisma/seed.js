import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@billit.local";
  const fullName = process.env.SEED_ADMIN_FULL_NAME || "Platform Admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { fullName, passwordHash, role: UserRole.ADMIN, isActive: true },
    create: { email, fullName, passwordHash, role: UserRole.ADMIN, isActive: true },
  });

  console.log(`Seeded admin user: ${email}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
