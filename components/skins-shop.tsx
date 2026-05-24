'use client'

import { useState, useEffect } from 'react'
import { getShopItems, purchaseItem, equipSkin } from '@/app/actions/game'
import { Button } from '@/components/ui/button'

interface ShopItem {
  id: string
  name: string
  description: string
  item_type: string
  price_crystals: number | null
  price_cents: number | null
  rarity: string
  data: {
    primaryColor?: string
    secondaryColor?: string
    glowIntensity?: number
    effect?: string
    duration?: number
    multiplier?: number
    damage?: number
  }
}

interface SkinsShopProps {
  onClose: () => void
  crystals: number
  ownedItems: string[]
  equippedSkin: string | null
  onPurchase: () => void
}

export function SkinsShop({
  onClose,
  crystals,
  ownedItems,
  equippedSkin,
  onPurchase,
}: SkinsShopProps) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [tab, setTab] = useState<'skins' | 'powerups'>('skins')
  const [error, setError] = useState('')

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const result = await getShopItems()
    if (result.items) {
      setItems(result.items)
    }
    setLoading(false)
  }

  const handlePurchase = async (itemId: string) => {
    setPurchasing(itemId)
    setError('')
    const result = await purchaseItem(itemId)
    if (result.error) {
      setError(result.error)
    } else {
      onPurchase()
      loadItems()
    }
    setPurchasing(null)
  }

  const handleEquip = async (itemId: string) => {
    setPurchasing(itemId)
    await equipSkin(itemId)
    onPurchase()
    setPurchasing(null)
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-500'
      case 'rare':
        return 'border-blue-500'
      case 'epic':
        return 'border-purple-500'
      case 'legendary':
        return 'border-yellow-500'
      default:
        return 'border-gray-500'
    }
  }

  const filteredItems = items.filter((item) =>
    tab === 'skins' ? item.item_type === 'skin' : item.item_type === 'powerup'
  )

  const renderSkinPreview = (item: ShopItem) => {
    const primary = item.data.primaryColor || '#00ffff'
    const secondary = item.data.secondaryColor || '#00ff88'
    const glow = item.data.glowIntensity || 1

    return (
      <svg viewBox="0 0 60 60" className="h-20 w-20">
        <defs>
          <filter id={`glow-${item.id}`}>
            <feGaussianBlur stdDeviation={glow * 2} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#glow-${item.id})`}>
          <polygon points="30,5 50,45 30,38 10,45" fill={primary} stroke={secondary} strokeWidth="2" />
          <polygon points="30,15 40,40 30,35 20,40" fill={secondary} fillOpacity="0.5" />
        </g>
      </svg>
    )
  }

  const renderPowerupIcon = (item: ShopItem) => {
    const effect = item.data.effect

    return (
      <div className="flex h-20 w-20 items-center justify-center">
        {effect === 'shield' && (
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-blue-400" fill="currentColor">
            <path d="M12 2l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V6l9-4z" />
          </svg>
        )}
        {effect === 'fireRate' && (
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-orange-400" fill="currentColor">
            <path d="M12 2c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm0 8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2s-2-.9-2-2v-8c0-1.1.9-2 2-2z" />
          </svg>
        )}
        {effect === 'damage' && (
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-red-400" fill="currentColor">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" />
          </svg>
        )}
        {effect === 'magnet' && (
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-purple-400" fill="currentColor">
            <path d="M3 7v6h4v-6c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v6h4V7c0-3.31-2.69-6-6-6H9C5.69 1 3 3.69 3 7z" />
          </svg>
        )}
        {effect === 'nuke' && (
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-yellow-400" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-gray-900/95 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cyan-400">Item Shop</h2>
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

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab('skins')}
            className={`rounded-lg px-6 py-2 font-semibold transition ${
              tab === 'skins' ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Skins
          </button>
          <button
            onClick={() => setTab('powerups')}
            className={`rounded-lg px-6 py-2 font-semibold transition ${
              tab === 'powerups' ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Power-ups
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 p-3 text-red-400">{error}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const owned = ownedItems.includes(item.id)
              const equipped = equippedSkin === item.id

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border-2 bg-gray-800/50 p-4 ${getRarityColor(item.rarity)} ${equipped ? 'ring-2 ring-cyan-400' : ''}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                        item.rarity === 'legendary'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : item.rarity === 'epic'
                            ? 'bg-purple-500/20 text-purple-400'
                            : item.rarity === 'rare'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {item.rarity}
                    </span>
                    {equipped && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                        EQUIPPED
                      </span>
                    )}
                  </div>

                  <div className="mb-3 flex justify-center">
                    {item.item_type === 'skin' ? renderSkinPreview(item) : renderPowerupIcon(item)}
                  </div>

                  <h3 className="mb-1 font-bold text-white">{item.name}</h3>
                  <p className="mb-4 text-sm text-gray-400">{item.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <svg
                        className="h-4 w-4 text-cyan-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      <span className="font-bold text-cyan-400">{item.price_crystals}</span>
                    </div>

                    {owned ? (
                      item.item_type === 'skin' && !equipped ? (
                        <Button
                          onClick={() => handleEquip(item.id)}
                          disabled={purchasing === item.id}
                          size="sm"
                          className="bg-cyan-500 text-black hover:bg-cyan-400"
                        >
                          {purchasing === item.id ? '...' : 'Equip'}
                        </Button>
                      ) : (
                        <span className="text-sm text-green-400">Owned</span>
                      )
                    ) : (
                      <Button
                        onClick={() => handlePurchase(item.id)}
                        disabled={purchasing === item.id || crystals < (item.price_crystals || 0)}
                        size="sm"
                        className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
                      >
                        {purchasing === item.id ? '...' : 'Buy'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
