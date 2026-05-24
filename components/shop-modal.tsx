'use client'

import { useState, useCallback, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { createCheckoutSession } from '@/app/actions/stripe'
import { CURRENCY_PACKS, type CurrencyPack } from '@/lib/products'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ShopModalProps {
  onClose: () => void
  crystals: number
}

export function ShopModal({ onClose, crystals }: ShopModalProps) {
  const [selectedPack, setSelectedPack] = useState<CurrencyPack | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    if (!selectedPack) return ''

    const result = await createCheckoutSession(selectedPack.id)
    if (result.clientSecret) {
      return result.clientSecret
    }
    return ''
  }, [selectedPack])

  useEffect(() => {
    if (selectedPack) {
      fetchClientSecret().then((secret) => {
        if (secret) setClientSecret(secret)
      })
    }
  }, [selectedPack, fetchClientSecret])

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-500 bg-gray-500/10'
      case 'rare':
        return 'border-blue-500 bg-blue-500/10'
      case 'epic':
        return 'border-purple-500 bg-purple-500/10'
      case 'legendary':
        return 'border-yellow-500 bg-yellow-500/10'
      default:
        return 'border-gray-500'
    }
  }

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'rare':
        return 'shadow-blue-500/30'
      case 'epic':
        return 'shadow-purple-500/30'
      case 'legendary':
        return 'shadow-yellow-500/50'
      default:
        return ''
    }
  }

  if (clientSecret && selectedPack) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-gray-900/95 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-400">Complete Purchase</h2>
            <button
              onClick={() => {
                setSelectedPack(null)
                setClientSecret(null)
              }}
              className="text-gray-400 transition hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-gray-900/95 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cyan-400">Crystal Shop</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-cyan-500/20 px-4 py-2">
              <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="font-bold text-cyan-400">{crystals}</span>
            </div>
            <button onClick={onClose} className="text-gray-400 transition hover:text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CURRENCY_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(pack)}
              className={`rounded-xl border-2 p-6 text-left transition hover:scale-[1.02] ${getRarityColor(pack.rarity)} shadow-lg ${getRarityGlow(pack.rarity)}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                    pack.rarity === 'legendary'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : pack.rarity === 'epic'
                        ? 'bg-purple-500/20 text-purple-400'
                        : pack.rarity === 'rare'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {pack.rarity}
                </span>
              </div>

              <h3 className="mb-1 text-lg font-bold text-white">{pack.name}</h3>

              <div className="mb-4 flex items-center gap-2">
                <svg className="h-6 w-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span className="text-2xl font-bold text-cyan-400">{pack.crystals}</span>
                {pack.bonus > 0 && (
                  <span className="text-sm font-semibold text-green-400">+{pack.bonus} Bonus</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">
                  ${(pack.priceInCents / 100).toFixed(2)}
                </span>
                <span className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">
                  Buy Now
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Secure payment powered by Stripe. Crystals are added instantly after purchase.
        </p>
      </div>
    </div>
  )
}
