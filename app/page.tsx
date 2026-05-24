"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthModal } from "@/components/auth-modal"
import { ShopModal } from "@/components/shop-modal"
import { SkinsShop } from "@/components/skins-shop"
import { getPlayerData, updateGameProgress } from "@/app/actions/game"
import type { User } from "@supabase/supabase-js"

// Game Constants
const PLAYER_SIZE = 20
const BULLET_SPEED = 12
const BULLET_SIZE = 4
const ENEMY_TYPES = {
  basic: { size: 15, speed: 2, hp: 1, color: "#ff4444", points: 10, damage: 10 },
  fast: { size: 10, speed: 4, hp: 1, color: "#ffaa00", points: 15, damage: 5 },
  tank: { size: 25, speed: 1, hp: 3, color: "#aa44ff", points: 25, damage: 20 },
  shooter: { size: 18, speed: 1.5, hp: 2, color: "#44ffaa", points: 30, damage: 15 },
}

interface SkinData {
  primaryColor: string
  secondaryColor: string
  glowIntensity: number
  trailEffect?: boolean
  particles?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  isEnemy?: boolean
}

interface Enemy {
  x: number
  y: number
  type: keyof typeof ENEMY_TYPES
  hp: number
  maxHp: number
  angle: number
  shootTimer: number
}

interface PowerUp {
  x: number
  y: number
  type: "heal" | "shield" | "rapid" | "damage"
  life: number
}

interface Player {
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  fireRate: number
  shield: number
  shieldMax: number
}

interface GameState {
  player: Player
  bullets: Bullet[]
  enemies: Enemy[]
  particles: Particle[]
  powerUps: PowerUp[]
  score: number
  wave: number
  xp: number
  level: number
  xpToNext: number
  kills: number
  totalKills: number
  gameTime: number
  waveTimer: number
  waveDelay: number
  rapidFireTimer: number
  damageBoostTimer: number
}

interface Upgrade {
  id: string
  name: string
  description: string
  icon: string
  apply: (state: GameState) => void
}

interface PlayerData {
  profile: { username: string; avatar_skin: string } | null
  currency: { neon_crystals: number; free_crystals: number } | null
  progress: { high_score: number; highest_wave: number; total_kills: number; total_games_played: number } | null
  inventory: Array<{ item_id: string; equipped: boolean; shop_items: { data: SkinData } }> | null
}

const UPGRADES: Upgrade[] = [
  {
    id: "maxHp",
    name: "Wytrzymalosc",
    description: "+25 Max HP",
    icon: "HP",
    apply: (s) => {
      s.player.maxHp += 25
      s.player.hp = Math.min(s.player.hp + 25, s.player.maxHp)
    },
  },
  {
    id: "damage",
    name: "Moc Ognia",
    description: "+1 Obrazenia",
    icon: "DMG",
    apply: (s) => {
      s.player.damage += 1
    },
  },
  {
    id: "speed",
    name: "Predkosc",
    description: "+0.5 Szybkosc",
    icon: "SPD",
    apply: (s) => {
      s.player.speed += 0.5
    },
  },
  {
    id: "fireRate",
    name: "Szybkostrzelnosc",
    description: "-15% Czas przeladowania",
    icon: "FIRE",
    apply: (s) => {
      s.player.fireRate *= 0.85
    },
  },
  {
    id: "shield",
    name: "Tarcza",
    description: "+15 Tarcza",
    icon: "SHD",
    apply: (s) => {
      s.player.shieldMax += 15
      s.player.shield = Math.min(s.player.shield + 15, s.player.shieldMax)
    },
  },
  {
    id: "regen",
    name: "Regeneracja",
    description: "Odzyskaj 30 HP",
    icon: "HEAL",
    apply: (s) => {
      s.player.hp = Math.min(s.player.hp + 30, s.player.maxHp)
    },
  },
]

const DEFAULT_SKIN: SkinData = {
  primaryColor: "#00ccff",
  secondaryColor: "#0088aa",
  glowIntensity: 1,
}

export default function NeonSurvivor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef<GameState | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const mouseRef = useRef({ x: 0, y: 0, down: false })
  const touchRef = useRef({ active: false, x: 0, y: 0, shootX: 0, shootY: 0 })
  const lastShotRef = useRef(0)
  const animationRef = useRef<number>(0)
  const gameStartTimeRef = useRef<number>(0)

  const [gameScreen, setGameScreen] = useState<"start" | "playing" | "paused" | "upgrade" | "gameover">("start")
  const [finalScore, setFinalScore] = useState(0)
  const [finalWave, setFinalWave] = useState(0)
  const [upgradeOptions, setUpgradeOptions] = useState<Upgrade[]>([])
  const [displayStats, setDisplayStats] = useState({ score: 0, wave: 1, hp: 100, maxHp: 100, shield: 0, level: 1, xp: 0, xpToNext: 100 })

  // Auth & Shop state
  const [user, setUser] = useState<User | null>(null)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showCrystalShop, setShowCrystalShop] = useState(false)
  const [showItemShop, setShowItemShop] = useState(false)
  const [currentSkin, setCurrentSkin] = useState<SkinData>(DEFAULT_SKIN)

  const supabase = createClient()

  // Load user and player data
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        await loadPlayerData()
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadPlayerData()
      } else {
        setPlayerData(null)
        setCurrentSkin(DEFAULT_SKIN)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadPlayerData = async () => {
    const data = await getPlayerData()
    if (!('error' in data)) {
      setPlayerData(data as PlayerData)
      
      // Find equipped skin
      const equipped = data.inventory?.find(item => item.equipped)
      if (equipped?.shop_items?.data) {
        setCurrentSkin(equipped.shop_items.data as SkinData)
      } else {
        setCurrentSkin(DEFAULT_SKIN)
      }
    }
  }

  const handleAuthSuccess = async () => {
    setShowAuthModal(false)
    await loadPlayerData()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setPlayerData(null)
    setCurrentSkin(DEFAULT_SKIN)
  }

  const totalCrystals = (playerData?.currency?.neon_crystals || 0) + (playerData?.currency?.free_crystals || 0)

  const initGame = useCallback((): GameState => {
    const canvas = canvasRef.current
    if (!canvas) throw new Error("Canvas not found")
    
    gameStartTimeRef.current = Date.now()
    
    return {
      player: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        hp: 100,
        maxHp: 100,
        speed: 5,
        damage: 1,
        fireRate: 150,
        shield: 0,
        shieldMax: 0,
      },
      bullets: [],
      enemies: [],
      particles: [],
      powerUps: [],
      score: 0,
      wave: 1,
      xp: 0,
      level: 1,
      xpToNext: 100,
      kills: 0,
      totalKills: 0,
      gameTime: 0,
      waveTimer: 0,
      waveDelay: 3000,
      rapidFireTimer: 0,
      damageBoostTimer: 0,
    }
  }, [])

  const spawnEnemy = useCallback((state: GameState, canvas: HTMLCanvasElement) => {
    const side = Math.floor(Math.random() * 4)
    let x: number, y: number

    switch (side) {
      case 0: x = Math.random() * canvas.width; y = -30; break
      case 1: x = canvas.width + 30; y = Math.random() * canvas.height; break
      case 2: x = Math.random() * canvas.width; y = canvas.height + 30; break
      default: x = -30; y = Math.random() * canvas.height; break
    }

    const types: (keyof typeof ENEMY_TYPES)[] = ["basic", "fast", "tank", "shooter"]
    const weights = [50, 20 + state.wave * 2, 15 + state.wave, 15 + state.wave * 2]
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * totalWeight
    let type: keyof typeof ENEMY_TYPES = "basic"

    for (let i = 0; i < types.length; i++) {
      if (rand < weights[i]) {
        type = types[i]
        break
      }
      rand -= weights[i]
    }

    const enemyType = ENEMY_TYPES[type]
    const hpMultiplier = 1 + (state.wave - 1) * 0.2

    state.enemies.push({
      x,
      y,
      type,
      hp: Math.ceil(enemyType.hp * hpMultiplier),
      maxHp: Math.ceil(enemyType.hp * hpMultiplier),
      angle: 0,
      shootTimer: 0,
    })
  }, [])

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number, state: GameState) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 4
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 30,
        maxLife: 60,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }, [])

  const spawnPowerUp = useCallback((x: number, y: number, state: GameState) => {
    if (Math.random() > 0.15) return
    const types: PowerUp["type"][] = ["heal", "shield", "rapid", "damage"]
    state.powerUps.push({
      x,
      y,
      type: types[Math.floor(Math.random() * types.length)],
      life: 600,
    })
  }, [])

  const checkCollision = (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) => {
    const dx = x1 - x2
    const dy = y1 - y2
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2)
  }

  const drawGlow = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, "transparent")
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, player: Player, angle: number) => {
    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(angle)

    const skin = currentSkin
    const glowColor = skin.primaryColor + "4D" // 30% opacity

    // Glow
    drawGlow(ctx, 0, 0, PLAYER_SIZE * 2 * skin.glowIntensity, glowColor)

    // Shield
    if (player.shield > 0) {
      ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + (player.shield / player.shieldMax) * 0.5})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, PLAYER_SIZE + 8, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Ship body
    ctx.fillStyle = skin.primaryColor
    ctx.beginPath()
    ctx.moveTo(PLAYER_SIZE, 0)
    ctx.lineTo(-PLAYER_SIZE * 0.7, -PLAYER_SIZE * 0.6)
    ctx.lineTo(-PLAYER_SIZE * 0.4, 0)
    ctx.lineTo(-PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.6)
    ctx.closePath()
    ctx.fill()

    // Ship accent
    ctx.fillStyle = skin.secondaryColor
    ctx.beginPath()
    ctx.moveTo(PLAYER_SIZE * 0.5, 0)
    ctx.lineTo(-PLAYER_SIZE * 0.3, -PLAYER_SIZE * 0.3)
    ctx.lineTo(-PLAYER_SIZE * 0.2, 0)
    ctx.lineTo(-PLAYER_SIZE * 0.3, PLAYER_SIZE * 0.3)
    ctx.closePath()
    ctx.fill()

    // Engine glow
    ctx.fillStyle = "#ff6600"
    ctx.beginPath()
    ctx.moveTo(-PLAYER_SIZE * 0.4, -PLAYER_SIZE * 0.3)
    ctx.lineTo(-PLAYER_SIZE * 0.8 - Math.random() * 10, 0)
    ctx.lineTo(-PLAYER_SIZE * 0.4, PLAYER_SIZE * 0.3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }, [currentSkin])

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const type = ENEMY_TYPES[enemy.type]
    const size = type.size

    // Glow
    drawGlow(ctx, enemy.x, enemy.y, size * 1.5, type.color + "40")

    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.rotate(enemy.angle)

    ctx.fillStyle = type.color
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2

    switch (enemy.type) {
      case "basic":
        ctx.beginPath()
        ctx.arc(0, 0, size, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
      case "fast":
        ctx.beginPath()
        ctx.moveTo(size, 0)
        ctx.lineTo(-size, -size * 0.6)
        ctx.lineTo(-size, size * 0.6)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      case "tank":
        ctx.fillRect(-size, -size, size * 2, size * 2)
        ctx.strokeRect(-size, -size, size * 2, size * 2)
        break
      case "shooter":
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size)
          ctx.lineTo(Math.cos(a + Math.PI / 6) * size * 0.5, Math.sin(a + Math.PI / 6) * size * 0.5)
          ctx.closePath()
          ctx.fill()
        }
        ctx.stroke()
        break
    }

    // HP bar
    if (enemy.hp < enemy.maxHp) {
      const barWidth = size * 2
      const barHeight = 4
      ctx.fillStyle = "#333"
      ctx.fillRect(-barWidth / 2, -size - 10, barWidth, barHeight)
      ctx.fillStyle = "#00ff00"
      ctx.fillRect(-barWidth / 2, -size - 10, barWidth * (enemy.hp / enemy.maxHp), barHeight)
    }

    ctx.restore()
  }

  const drawBullet = (ctx: CanvasRenderingContext2D, bullet: Bullet) => {
    const color = bullet.isEnemy ? "#ff4444" : currentSkin.primaryColor
    drawGlow(ctx, bullet.x, bullet.y, BULLET_SIZE * 3, color + "60")
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(bullet.x, bullet.y, BULLET_SIZE, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawPowerUp = (ctx: CanvasRenderingContext2D, powerUp: PowerUp) => {
    const colors: Record<PowerUp["type"], string> = {
      heal: "#00ff00",
      shield: "#00aaff",
      rapid: "#ffff00",
      damage: "#ff0000",
    }
    const color = colors[powerUp.type]
    const pulse = Math.sin(Date.now() / 200) * 3

    drawGlow(ctx, powerUp.x, powerUp.y, 20 + pulse, color + "60")
    
    ctx.fillStyle = color
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(powerUp.x, powerUp.y, 10 + pulse / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "#fff"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const icons: Record<PowerUp["type"], string> = { heal: "+", shield: "O", rapid: ">", damage: "!" }
    ctx.fillText(icons[powerUp.type], powerUp.x, powerUp.y)
  }

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    const alpha = particle.life / particle.maxLife
    ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, "0")
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawStarfield = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    ctx.fillStyle = "#0a0a1a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Stars
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5 + time * 0.02 * ((i % 3) + 1)) % canvas.width
      const y = (i * 97.3) % canvas.height
      const size = (i % 3) + 1
      const alpha = 0.3 + (Math.sin(time / 500 + i) + 1) * 0.35
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const saveGameProgress = useCallback(async (state: GameState) => {
    if (!user) return

    const playtimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000)
    
    await updateGameProgress({
      score: state.score,
      wave: state.wave,
      kills: state.totalKills,
      playtimeSeconds,
    })
  }, [user])

  const update = useCallback((state: GameState, canvas: HTMLCanvasElement, deltaTime: number) => {
    state.gameTime += deltaTime

    // Player movement
    let dx = 0, dy = 0
    if (keysRef.current.has("w") || keysRef.current.has("arrowup")) dy -= 1
    if (keysRef.current.has("s") || keysRef.current.has("arrowdown")) dy += 1
    if (keysRef.current.has("a") || keysRef.current.has("arrowleft")) dx -= 1
    if (keysRef.current.has("d") || keysRef.current.has("arrowright")) dx += 1

    // Touch joystick movement
    if (touchRef.current.active) {
      const touchDx = touchRef.current.x - canvas.width * 0.15
      const touchDy = touchRef.current.y - canvas.height * 0.75
      const touchDist = Math.sqrt(touchDx * touchDx + touchDy * touchDy)
      if (touchDist > 10) {
        dx = touchDx / touchDist
        dy = touchDy / touchDist
      }
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy)
      dx /= len
      dy /= len
      state.player.x += dx * state.player.speed
      state.player.y += dy * state.player.speed
    }

    // Clamp player position
    state.player.x = Math.max(PLAYER_SIZE, Math.min(canvas.width - PLAYER_SIZE, state.player.x))
    state.player.y = Math.max(PLAYER_SIZE, Math.min(canvas.height - PLAYER_SIZE, state.player.y))

    // Shooting
    const now = Date.now()
    const fireRate = state.rapidFireTimer > 0 ? state.player.fireRate * 0.5 : state.player.fireRate
    
    if (now - lastShotRef.current > fireRate) {
      let targetX = mouseRef.current.x
      let targetY = mouseRef.current.y

      if (touchRef.current.active && touchRef.current.shootX !== 0) {
        targetX = touchRef.current.shootX
        targetY = touchRef.current.shootY
      }

      if (mouseRef.current.down || touchRef.current.active) {
        const angle = Math.atan2(targetY - state.player.y, targetX - state.player.x)
        const damage = state.damageBoostTimer > 0 ? state.player.damage * 2 : state.player.damage

        state.bullets.push({
          x: state.player.x + Math.cos(angle) * PLAYER_SIZE,
          y: state.player.y + Math.sin(angle) * PLAYER_SIZE,
          vx: Math.cos(angle) * BULLET_SPEED,
          vy: Math.sin(angle) * BULLET_SPEED,
          damage,
        })
        lastShotRef.current = now
      }
    }

    // Update timers
    if (state.rapidFireTimer > 0) state.rapidFireTimer -= deltaTime
    if (state.damageBoostTimer > 0) state.damageBoostTimer -= deltaTime

    // Update bullets
    state.bullets = state.bullets.filter((bullet) => {
      bullet.x += bullet.vx
      bullet.y += bullet.vy
      return bullet.x > -50 && bullet.x < canvas.width + 50 && bullet.y > -50 && bullet.y < canvas.height + 50
    })

    // Spawn enemies
    state.waveTimer += deltaTime
    const spawnInterval = Math.max(500, 2000 - state.wave * 100)
    const maxEnemies = 5 + state.wave * 2

    if (state.waveTimer > spawnInterval && state.enemies.length < maxEnemies) {
      spawnEnemy(state, canvas)
      state.waveTimer = 0
    }

    // Update enemies
    state.enemies.forEach((enemy) => {
      const type = ENEMY_TYPES[enemy.type]
      const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x)
      enemy.angle = angle

      enemy.x += Math.cos(angle) * type.speed
      enemy.y += Math.sin(angle) * type.speed

      // Shooter enemies fire bullets
      if (enemy.type === "shooter") {
        enemy.shootTimer += deltaTime
        if (enemy.shootTimer > 2000) {
          state.bullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            damage: type.damage,
            isEnemy: true,
          })
          enemy.shootTimer = 0
        }
      }
    })

    // Bullet-enemy collisions
    state.bullets = state.bullets.filter((bullet) => {
      if (bullet.isEnemy) return true

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i]
        const type = ENEMY_TYPES[enemy.type]

        if (checkCollision(bullet.x, bullet.y, BULLET_SIZE, enemy.x, enemy.y, type.size)) {
          enemy.hp -= bullet.damage
          spawnParticles(bullet.x, bullet.y, type.color, 5, state)

          if (enemy.hp <= 0) {
            spawnParticles(enemy.x, enemy.y, type.color, 15, state)
            spawnPowerUp(enemy.x, enemy.y, state)
            state.score += type.points
            state.xp += type.points
            state.kills++
            state.totalKills++

            // Check level up
            if (state.xp >= state.xpToNext) {
              state.xp -= state.xpToNext
              state.level++
              state.xpToNext = Math.floor(state.xpToNext * 1.5)
              
              // Show upgrade screen
              const options = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3)
              setUpgradeOptions(options)
              setGameScreen("upgrade")
            }

            state.enemies.splice(i, 1)
          }
          return false
        }
      }
      return true
    })

    // Enemy-player collisions
    state.enemies = state.enemies.filter((enemy) => {
      const type = ENEMY_TYPES[enemy.type]
      if (checkCollision(state.player.x, state.player.y, PLAYER_SIZE, enemy.x, enemy.y, type.size)) {
        const damage = type.damage

        if (state.player.shield > 0) {
          const shieldDamage = Math.min(state.player.shield, damage)
          state.player.shield -= shieldDamage
          const remaining = damage - shieldDamage
          state.player.hp -= remaining
        } else {
          state.player.hp -= damage
        }

        spawnParticles(enemy.x, enemy.y, type.color, 10, state)
        return false
      }
      return true
    })

    // Enemy bullet-player collisions
    state.bullets = state.bullets.filter((bullet) => {
      if (!bullet.isEnemy) return true

      if (checkCollision(bullet.x, bullet.y, BULLET_SIZE, state.player.x, state.player.y, PLAYER_SIZE)) {
        if (state.player.shield > 0) {
          const shieldDamage = Math.min(state.player.shield, bullet.damage)
          state.player.shield -= shieldDamage
          state.player.hp -= bullet.damage - shieldDamage
        } else {
          state.player.hp -= bullet.damage
        }
        spawnParticles(bullet.x, bullet.y, "#ff0000", 5, state)
        return false
      }
      return true
    })

    // PowerUp collection
    state.powerUps = state.powerUps.filter((powerUp) => {
      powerUp.life--
      if (powerUp.life <= 0) return false

      if (checkCollision(state.player.x, state.player.y, PLAYER_SIZE, powerUp.x, powerUp.y, 15)) {
        switch (powerUp.type) {
          case "heal":
            state.player.hp = Math.min(state.player.hp + 25, state.player.maxHp)
            break
          case "shield":
            state.player.shield = Math.min(state.player.shield + 20, Math.max(state.player.shieldMax, 20))
            break
          case "rapid":
            state.rapidFireTimer = 5000
            break
          case "damage":
            state.damageBoostTimer = 5000
            break
        }
        spawnParticles(powerUp.x, powerUp.y, "#ffffff", 10, state)
        return false
      }
      return true
    })

    // Update particles
    state.particles = state.particles.filter((particle) => {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vx *= 0.98
      particle.vy *= 0.98
      particle.life--
      return particle.life > 0
    })

    // Wave progression
    if (state.kills >= state.wave * 10) {
      state.wave++
      state.kills = 0
    }

    // Check game over
    if (state.player.hp <= 0) {
      setFinalScore(state.score)
      setFinalWave(state.wave)
      saveGameProgress(state)
      setGameScreen("gameover")
    }

    // Update display stats
    setDisplayStats({
      score: state.score,
      wave: state.wave,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      shield: state.player.shield,
      level: state.level,
      xp: state.xp,
      xpToNext: state.xpToNext,
    })
  }, [spawnEnemy, spawnParticles, spawnPowerUp, saveGameProgress])

  const render = useCallback((ctx: CanvasRenderingContext2D, state: GameState, canvas: HTMLCanvasElement) => {
    drawStarfield(ctx, canvas, state.gameTime)

    // Draw power-ups
    state.powerUps.forEach((p) => drawPowerUp(ctx, p))

    // Draw bullets
    state.bullets.forEach((b) => drawBullet(ctx, b))

    // Draw enemies
    state.enemies.forEach((e) => drawEnemy(ctx, e))

    // Draw player
    const targetX = touchRef.current.active ? touchRef.current.shootX || mouseRef.current.x : mouseRef.current.x
    const targetY = touchRef.current.active ? touchRef.current.shootY || mouseRef.current.y : mouseRef.current.y
    const playerAngle = Math.atan2(targetY - state.player.y, targetX - state.player.x)
    drawPlayer(ctx, state.player, playerAngle)

    // Draw particles
    state.particles.forEach((p) => drawParticle(ctx, p))

    // Draw touch controls hint on mobile
    if (touchRef.current.active || "ontouchstart" in window) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
      ctx.lineWidth = 2

      // Left joystick area
      ctx.beginPath()
      ctx.arc(canvas.width * 0.15, canvas.height * 0.75, 50, 0, Math.PI * 2)
      ctx.stroke()

      // Right aim area
      ctx.beginPath()
      ctx.arc(canvas.width * 0.85, canvas.height * 0.75, 50, 0, Math.PI * 2)
      ctx.stroke()

      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText("RUCH", canvas.width * 0.15, canvas.height * 0.75 + 60)
      ctx.fillText("CEL", canvas.width * 0.85, canvas.height * 0.75 + 60)
    }

    // Draw buff indicators
    ctx.font = "14px Arial"
    ctx.textAlign = "left"
    let buffY = 120

    if (state.rapidFireTimer > 0) {
      ctx.fillStyle = "#ffff00"
      ctx.fillText(`Szybki ogien: ${Math.ceil(state.rapidFireTimer / 1000)}s`, 10, buffY)
      buffY += 20
    }

    if (state.damageBoostTimer > 0) {
      ctx.fillStyle = "#ff4444"
      ctx.fillText(`Podwojne obrazenia: ${Math.ceil(state.damageBoostTimer / 1000)}s`, 10, buffY)
    }
  }, [drawPlayer])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const state = gameStateRef.current

    if (!canvas || !ctx || !state || gameScreen !== "playing") return

    update(state, canvas, 16.67)
    render(ctx, state, canvas)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameScreen, update, render])

  const startGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    gameStateRef.current = initGame()
    setGameScreen("playing")
  }, [initGame])

  const selectUpgrade = useCallback((upgrade: Upgrade) => {
    if (gameStateRef.current) {
      upgrade.apply(gameStateRef.current)
    }
    setGameScreen("playing")
  }, [])

  const togglePause = useCallback(() => {
    setGameScreen((prev) => (prev === "playing" ? "paused" : prev === "paused" ? "playing" : prev))
  }, [])

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)

      if (key === "escape" || key === "p") {
        togglePause()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    const handleMouseDown = () => {
      mouseRef.current.down = true
    }

    const handleMouseUp = () => {
      mouseRef.current.down = false
    }

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      for (const touch of Array.from(e.touches)) {
        if (touch.clientX < canvas.width / 2) {
          touchRef.current.active = true
          touchRef.current.x = touch.clientX
          touchRef.current.y = touch.clientY
        } else {
          touchRef.current.shootX = touch.clientX
          touchRef.current.shootY = touch.clientY
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      for (const touch of Array.from(e.touches)) {
        if (touch.clientX < canvas.width / 2) {
          touchRef.current.x = touch.clientX
          touchRef.current.y = touch.clientY
        } else {
          touchRef.current.shootX = touch.clientX
          touchRef.current.shootY = touch.clientY
        }
      }
    }

    const handleTouchEnd = () => {
      touchRef.current.active = false
      touchRef.current.shootX = 0
      touchRef.current.shootY = 0
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("touchstart", handleTouchStart, { passive: false })
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("touchend", handleTouchEnd)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [togglePause])

  // Game loop
  useEffect(() => {
    if (gameScreen === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameScreen, gameLoop])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a1a]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD */}
      {gameScreen === "playing" && (
        <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
          <div className="flex justify-between items-start max-w-4xl mx-auto">
            <div className="space-y-2">
              <div className="text-white font-bold text-xl">Wynik: {displayStats.score}</div>
              <div className="text-cyan-400">Fala: {displayStats.wave}</div>
              <div className="text-purple-400">Poziom: {displayStats.level}</div>
              
              {/* HP Bar */}
              <div className="w-48">
                <div className="text-xs text-gray-400 mb-1">HP</div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-200"
                    style={{ width: `${(displayStats.hp / displayStats.maxHp) * 100}%` }}
                  />
                </div>
              </div>

              {/* Shield Bar */}
              {displayStats.shield > 0 && (
                <div className="w-48">
                  <div className="text-xs text-gray-400 mb-1">Tarcza</div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-200"
                      style={{ width: `${Math.min(100, (displayStats.shield / 50) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* XP Bar */}
              <div className="w-48">
                <div className="text-xs text-gray-400 mb-1">XP: {displayStats.xp}/{displayStats.xpToNext}</div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-200"
                    style={{ width: `${(displayStats.xp / displayStats.xpToNext) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={togglePause}
              className="pointer-events-auto px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              PAUZA
            </button>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameScreen === "start" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#0a0a2a] to-[#1a0a2a]">
          <div className="text-center space-y-6 p-8 max-w-lg">
            {/* User bar */}
            <div className="flex justify-center gap-4 mb-8">
              {user ? (
                <>
                  <div className="flex items-center gap-3 bg-gray-800/80 rounded-full px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-black font-bold">
                      {playerData?.profile?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-white font-medium">{playerData?.profile?.username || "Gracz"}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-cyan-500/20 rounded-full px-4 py-2">
                    <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="text-cyan-400 font-bold">{totalCrystals}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors text-sm"
                  >
                    Wyloguj
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-full transition-colors"
                >
                  Zaloguj sie
                </button>
              )}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              NEON SURVIVOR
            </h1>
            
            <p className="text-gray-400 text-base max-w-md mx-auto">
              Przetrwaj fale wrogow, zbieraj ulepszenia i zostaw najlepszym pilotem w galaktyce!
            </p>

            {/* Stats */}
            {playerData?.progress && (
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-cyan-400">{playerData.progress.high_score}</div>
                  <div className="text-xs text-gray-400">Rekord</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-400">{playerData.progress.highest_wave}</div>
                  <div className="text-xs text-gray-400">Max Fala</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-400">{playerData.progress.total_kills}</div>
                  <div className="text-xs text-gray-400">Zabici</div>
                </div>
              </div>
            )}
            
            <div className="space-y-2 text-gray-400 text-sm">
              <p><strong>PC:</strong> WASD/Strzalki - ruch | Mysz - cel | Klik - strzal</p>
              <p><strong>Mobile:</strong> Lewy joystick - ruch | Prawy obszar - cel</p>
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={startGame}
                className="w-full px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xl font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30"
              >
                ROZPOCZNIJ GRE
              </button>

              {user && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowItemShop(true)}
                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors"
                  >
                    Sklep Skinow
                  </button>
                  <button
                    onClick={() => setShowCrystalShop(true)}
                    className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-colors"
                  >
                    Kup Krysztaly
                  </button>
                </div>
              )}

              {!user && (
                <p className="text-gray-500 text-sm">
                  Zaloguj sie aby odblokowac skiny, zapisywac postep i rywalizowac!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pause Screen */}
      {gameScreen === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center space-y-6 p-8 bg-gray-900/90 rounded-2xl border border-gray-700">
            <h2 className="text-4xl font-bold text-white">PAUZA</h2>
            <div className="space-y-4">
              <button
                onClick={togglePause}
                className="w-full px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xl font-bold rounded-xl transition-colors"
              >
                Kontynuuj
              </button>
              <button
                onClick={() => setGameScreen("start")}
                className="w-full px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-xl transition-colors"
              >
                Menu glowne
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Screen */}
      {gameScreen === "upgrade" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center space-y-6 p-8 max-w-2xl">
            <h2 className="text-4xl font-bold text-yellow-400">NOWY POZIOM!</h2>
            <p className="text-gray-300">Wybierz ulepszenie:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upgradeOptions.map((upgrade) => (
                <button
                  key={upgrade.id}
                  onClick={() => selectUpgrade(upgrade)}
                  className="p-6 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 hover:border-cyan-500 rounded-xl transition-all transform hover:scale-105 space-y-3"
                >
                  <div className="text-2xl font-bold text-cyan-400">{upgrade.icon}</div>
                  <div className="text-white font-bold">{upgrade.name}</div>
                  <div className="text-gray-400 text-sm">{upgrade.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameScreen === "gameover" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a0a0a] to-[#2a0a1a]">
          <div className="text-center space-y-6 p-8">
            <h2 className="text-5xl font-bold text-red-500">KONIEC GRY</h2>
            
            <div className="space-y-2 text-gray-300">
              <p className="text-3xl text-white font-bold">Wynik: {finalScore}</p>
              <p className="text-xl">Osiagnieta fala: {finalWave}</p>
            </div>

            {user && playerData?.progress && finalScore > playerData.progress.high_score && (
              <div className="py-4">
                <span className="px-6 py-2 bg-yellow-500/20 text-yellow-400 font-bold rounded-full">
                  NOWY REKORD!
                </span>
              </div>
            )}

            <div className="space-y-4 pt-4">
              <button
                onClick={startGame}
                className="w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-xl font-bold rounded-xl transition-all transform hover:scale-105"
              >
                Zagraj ponownie
              </button>
              <button
                onClick={() => {
                  loadPlayerData()
                  setGameScreen("start")
                }}
                className="w-full px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold rounded-xl transition-colors"
              >
                Menu glowne
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}

      {showCrystalShop && user && (
        <ShopModal onClose={() => setShowCrystalShop(false)} crystals={totalCrystals} />
      )}

      {showItemShop && user && playerData && (
        <SkinsShop
          onClose={() => setShowItemShop(false)}
          crystals={totalCrystals}
          ownedItems={playerData.inventory?.map(i => i.item_id) || []}
          equippedSkin={playerData.inventory?.find(i => i.equipped)?.item_id || null}
          onPurchase={loadPlayerData}
        />
      )}
    </div>
  )
}
