'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPlayerData() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const [profileResult, currencyResult, progressResult, inventoryResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('player_currency').select('*').eq('user_id', user.id).single(),
    supabase.from('game_progress').select('*').eq('user_id', user.id).single(),
    supabase.from('player_inventory').select('*, shop_items(*)').eq('user_id', user.id),
  ])

  return {
    profile: profileResult.data,
    currency: currencyResult.data,
    progress: progressResult.data,
    inventory: inventoryResult.data || [],
  }
}

export async function getShopItems() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('price_crystals', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { items: data }
}

export async function purchaseItem(itemId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get item details
  const { data: item, error: itemError } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    return { error: 'Item not found' }
  }

  if (!item.price_crystals) {
    return { error: 'This item cannot be purchased with crystals' }
  }

  // Get player currency
  const { data: currency, error: currencyError } = await supabase
    .from('player_currency')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (currencyError || !currency) {
    return { error: 'Currency data not found' }
  }

  const totalCrystals = currency.neon_crystals + currency.free_crystals

  if (totalCrystals < item.price_crystals) {
    return { error: 'Not enough crystals' }
  }

  // Check if already owned (for skins)
  if (item.item_type === 'skin') {
    const { data: existing } = await supabase
      .from('player_inventory')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .single()

    if (existing) {
      return { error: 'You already own this item' }
    }
  }

  // Deduct crystals (use free crystals first)
  let remaining = item.price_crystals
  let newFreeCrystals = currency.free_crystals
  let newNeonCrystals = currency.neon_crystals

  if (newFreeCrystals >= remaining) {
    newFreeCrystals -= remaining
  } else {
    remaining -= newFreeCrystals
    newFreeCrystals = 0
    newNeonCrystals -= remaining
  }

  // Update currency
  const { error: updateError } = await supabase
    .from('player_currency')
    .update({
      free_crystals: newFreeCrystals,
      neon_crystals: newNeonCrystals,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    return { error: 'Failed to update currency' }
  }

  // Add to inventory
  const { error: inventoryError } = await supabase.from('player_inventory').upsert(
    {
      user_id: user.id,
      item_id: itemId,
      quantity: item.item_type === 'powerup' ? 1 : 1,
    },
    {
      onConflict: 'user_id,item_id',
    }
  )

  if (inventoryError) {
    return { error: 'Failed to add item to inventory' }
  }

  // Record purchase
  await supabase.from('purchase_history').insert({
    user_id: user.id,
    item_id: itemId,
    crystals_amount: item.price_crystals,
    purchase_type: 'item',
  })

  revalidatePath('/shop')
  return { success: true }
}

export async function equipSkin(itemId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check ownership
  const { data: inventoryItem } = await supabase
    .from('player_inventory')
    .select('*, shop_items(*)')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single()

  if (!inventoryItem) {
    return { error: 'You do not own this item' }
  }

  // Unequip all skins first
  await supabase
    .from('player_inventory')
    .update({ equipped: false })
    .eq('user_id', user.id)
    .eq('equipped', true)

  // Equip selected skin
  await supabase
    .from('player_inventory')
    .update({ equipped: true })
    .eq('user_id', user.id)
    .eq('item_id', itemId)

  // Update profile
  await supabase.from('profiles').update({ avatar_skin: itemId }).eq('id', user.id)

  revalidatePath('/shop')
  return { success: true }
}

export async function updateGameProgress(data: {
  score: number
  wave: number
  kills: number
  playtimeSeconds: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: current } = await supabase
    .from('game_progress')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!current) {
    return { error: 'Progress data not found' }
  }

  const { error } = await supabase
    .from('game_progress')
    .update({
      high_score: Math.max(current.high_score, data.score),
      highest_wave: Math.max(current.highest_wave, data.wave),
      total_kills: current.total_kills + data.kills,
      total_games_played: current.total_games_played + 1,
      total_playtime_seconds: current.total_playtime_seconds + data.playtimeSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function addCrystals(amount: number, stripeSessionId?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: currency } = await supabase
    .from('player_currency')
    .select('neon_crystals')
    .eq('user_id', user.id)
    .single()

  if (!currency) {
    return { error: 'Currency data not found' }
  }

  const { error } = await supabase
    .from('player_currency')
    .update({
      neon_crystals: currency.neon_crystals + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  // Record purchase if from Stripe
  if (stripeSessionId) {
    await supabase.from('purchase_history').insert({
      user_id: user.id,
      stripe_session_id: stripeSessionId,
      crystals_amount: amount,
      purchase_type: 'crystals',
    })
  }

  return { success: true }
}
