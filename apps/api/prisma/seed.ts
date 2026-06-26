import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const basicPlan = await prisma.plan.upsert({
    where: { type: 'basic' },
    update: {},
    create: {
      name: 'Básico',
      type: 'basic',
      price: 99.9,
      maxDevices: 5,
      storageGB: 10,
      maxChannels: 20,
      maxPlaylists: 5,
      maxUsers: 2,
    },
  })

  const premiumPlan = await prisma.plan.upsert({
    where: { type: 'premium' },
    update: {},
    create: {
      name: 'Premium',
      type: 'premium',
      price: 199.9,
      maxDevices: 50,
      storageGB: 100,
      maxChannels: 200,
      maxPlaylists: 50,
      maxUsers: 10,
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@iptvagao.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'master_admin',
      active: true,
    },
  })

  console.log({ basicPlan, premiumPlan, adminUser })
}

main().catch(console.error).finally(() => prisma.$disconnect())
