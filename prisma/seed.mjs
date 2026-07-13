import { PrismaClient, SystemRole, OrganizationRole } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL || "fchienvuhoang@gmail.com";

const organization = await prisma.organization.upsert({
  where: { slug: "he-thong" },
  update: {},
  create: { name: "Tổ chức mặc định", slug: "he-thong" },
});

const user = await prisma.user.upsert({
  where: { email },
  update: { enabled: true, systemRole: SystemRole.SUPER_ADMIN },
  create: { email, name: "Quản trị viên", systemRole: SystemRole.SUPER_ADMIN },
});

await prisma.membership.upsert({
  where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
  update: { role: OrganizationRole.ADMIN },
  create: { userId: user.id, organizationId: organization.id, role: OrganizationRole.ADMIN },
});

console.log(`Seeded ${email}`);
await prisma.$disconnect();
