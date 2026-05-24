export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import SetupClient from './SetupClient'

async function getConnectedCreators() {
  return prisma.creator.findMany({
    where: { accessToken: { not: null } },
    select: { id: true, name: true, username: true, connectedAt: true },
    orderBy: { name: 'asc' },
  })
}

export default async function SetupPage() {
  const creators = await getConnectedCreators()
  return (
    <Suspense>
      <SetupClient connectedCreators={creators} />
    </Suspense>
  )
}
