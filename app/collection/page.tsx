import type { Metadata } from 'next'
import { CollectionScreen } from '@/components/screens/CollectionScreen'

export const metadata: Metadata = { title: 'Collezione — Harry Draft' }

export default function Page() {
  return <CollectionScreen />
}
