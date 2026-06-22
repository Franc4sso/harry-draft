import type { Metadata } from 'next'
import { RulesScreen } from '@/components/screens/RulesScreen'

export const metadata: Metadata = { title: 'Regole — Harry Draft' }

export default function Page() {
  return <RulesScreen />
}
