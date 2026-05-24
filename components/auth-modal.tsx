'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AuthModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
          data: {
            username: username || `Player_${Date.now().toString(36)}`,
          },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for confirmation link!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        onSuccess()
      }
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-gray-900/95 p-8 shadow-2xl shadow-cyan-500/20">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cyan-400">
            {mode === 'login' ? 'Welcome Back' : 'Join the Battle'}
          </h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-sm text-gray-300">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="border-cyan-500/30 bg-gray-800 text-white placeholder:text-gray-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-300">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
              className="border-cyan-500/30 bg-gray-800 text-white placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-300">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
              className="border-cyan-500/30 bg-gray-800 text-white placeholder:text-gray-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 font-semibold text-black transition hover:bg-cyan-400"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-sm text-cyan-400 transition hover:text-cyan-300"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          Sign up to save progress, unlock skins, and compete on leaderboards!
        </div>
      </div>
    </div>
  )
}
