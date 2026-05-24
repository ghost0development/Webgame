'use server'

import { stripe } from '@/lib/stripe'
import { CURRENCY_PACKS } from '@/lib/products'
import { createClient } from '@/lib/supabase/server'

export async function createCheckoutSession(packId: string) {
  const pack = CURRENCY_PACKS.find((p) => p.id === packId)

  if (!pack) {
    return { error: 'Product not found' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pack.name,
              description: pack.description,
            },
            unit_amount: pack.priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: user.id,
        packId: pack.id,
        crystals: pack.crystals + pack.bonus,
      },
    })

    return { clientSecret: session.client_secret }
  } catch (error) {
    console.error('Stripe error:', error)
    return { error: 'Failed to create checkout session' }
  }
}

export async function getCheckoutSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return { session }
  } catch (error) {
    console.error('Error retrieving session:', error)
    return { error: 'Failed to retrieve session' }
  }
}
