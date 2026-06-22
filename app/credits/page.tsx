import type { Metadata } from 'next'
import { CreditsScreen } from '@/components/screens/CreditsScreen'

export const metadata: Metadata = { title: 'Credits — Harry Draft' }

export default function Page() {
  return <CreditsScreen />
}
