import { PrismaClient, SystemRole, OrganizationRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL || "admin@thienphap.local";
const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const passwordHash = await bcrypt.hash(password, 12);

const organization = await prisma.organization.upsert({
  where: { slug: "he-thong" },
  update: {},
  create: { name: "Tổ chức mặc định", slug: "he-thong" },
});

const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, enabled: true },
  create: { email, name: "Quản trị viên", passwordHash, systemRole: SystemRole.SUPER_ADMIN },
});

await prisma.membership.upsert({
  where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
  update: { role: OrganizationRole.ADMIN },
  create: { userId: user.id, organizationId: organization.id, role: OrganizationRole.ADMIN },
});

console.log(`Seeded ${email}`);
await prisma.$disconnect();
