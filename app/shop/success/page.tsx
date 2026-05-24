import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCheckoutSession } from '@/app/actions/stripe'
import { addCrystals } from '@/app/actions/game'
import { CURRENCY_PACKS } from '@/lib/products'
import Link from 'next/link'

async function SuccessContent({ sessionId }: { sessionId: string }) {
  const { session, error } = await getCheckoutSession(sessionId)

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4">
        <div className="rounded-2xl border border-red-500/30 bg-gray-900/95 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-400">Payment Error</h1>
          <p className="mb-6 text-gray-400">Something went wrong with your payment.</p>
          <Link
            href="/"
            className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400"
          >
            Return to Game
          </Link>
        </div>
      </div>
    )
  }

  if (session.payment_status === 'paid') {
    const packId = session.metadata?.packId
    const pack = CURRENCY_PACKS.find((p) => p.id === packId)

    if (pack) {
      // Add crystals to user account
      await addCrystals(pack.crystals + pack.bonus, sessionId)
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4">
        <div className="rounded-2xl border border-cyan-500/30 bg-gray-900/95 p-8 text-center shadow-2xl shadow-cyan-500/20">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-10 w-10 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-3xl font-bold text-cyan-400">Payment Successful!</h1>
          <p className="mb-6 text-gray-400">Your crystals have been added to your account.</p>

          {pack && (
            <div className="mb-8 rounded-xl bg-gray-800/50 p-6">
              <div className="mb-2 text-lg font-semibold text-white">{pack.name}</div>
              <div className="flex items-center justify-center gap-2">
                <svg className="h-8 w-8 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span className="text-3xl font-bold text-cyan-400">
                  +{pack.crystals + pack.bonus}
                </span>
              </div>
              {pack.bonus > 0 && (
                <div className="mt-2 text-sm text-green-400">Includes {pack.bonus} bonus crystals!</div>
              )}
            </div>
          )}

          <Link
            href="/"
            className="inline-block rounded-lg bg-cyan-500 px-8 py-3 font-semibold text-black transition hover:bg-cyan-400"
          >
            Return to Game
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4">
      <div className="rounded-2xl border border-yellow-500/30 bg-gray-900/95 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-yellow-400">Payment Pending</h1>
        <p className="mb-6 text-gray-400">Your payment is still being processed.</p>
        <Link
          href="/"
          className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400"
        >
          Return to Game
        </Link>
      </div>
    </div>
  )
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const params = await searchParams
  const sessionId = params.session_id

  if (!sessionId) {
    redirect('/')
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="text-cyan-400">Processing payment...</div>
        </div>
      }
    >
      <SuccessContent sessionId={sessionId} />
    </Suspense>
  )
}
