import { Suspense } from 'react'
import { SignupContent } from './signup-content'

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <SignupContent />
    </Suspense>
  )
}
