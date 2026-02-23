"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
}

export function AnimatedBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let animationFrameId: number
        let particles: Particle[] = []
        const mouse = { x: -1000, y: -1000 }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            initParticles()
        }

        const initParticles = () => {
            particles = []
            // Adjust particle count based on screen size for performance
            const particleCount = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 100)

            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * 3 + 1.5 // Powiększony, minimalnie grubszy rozmiar
                })
            }
        }

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX
            mouse.y = e.clientY
        }

        const onMouseLeave = () => {
            mouse.x = -1000
            mouse.y = -1000
        }

        window.addEventListener("resize", resize)
        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseleave", onMouseLeave)

        resize()

        const isDark = resolvedTheme === "dark"
        // Zwiekszona jasność i widoczność dla cząsteczek początkowych
        const dotColor = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.25)"
        const lineColor = isDark ? "rgba(255, 255, 255, " : "rgba(0, 0, 0, "

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Update & Draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i]
                p.x += p.vx
                p.y += p.vy

                // Bounce off edges
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1

                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fillStyle = dotColor
                ctx.fill()
            }

            // Draw connecting lines
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x
                    const dy = particles[i].y - particles[j].y
                    const dist = Math.sqrt(dx * dx + dy * dy)

                    if (dist < 150) {
                        ctx.beginPath()
                        // Jaśniejsze o 0.1 i grubsze stałe połączenia naturalne
                        ctx.strokeStyle = `${lineColor}${0.25 * (1 - dist / 150)})`
                        ctx.lineWidth = 1.2
                        ctx.moveTo(particles[i].x, particles[i].y)
                        ctx.lineTo(particles[j].x, particles[j].y)
                        ctx.stroke()
                    }
                }

                // Connect to mouse
                const dxMouse = particles[i].x - mouse.x
                const dyMouse = particles[i].y - mouse.y
                const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)

                if (distMouse < 220) { // Lekko zwiększony promień reagowania myszy
                    ctx.beginPath()
                    // Znacząco silniejsze doświetlenie punktowe względem kursora
                    ctx.strokeStyle = `${lineColor}${0.4 * (1 - distMouse / 220)})`
                    ctx.lineWidth = 1.8
                    ctx.moveTo(particles[i].x, particles[i].y)
                    ctx.lineTo(mouse.x, mouse.y)
                    ctx.stroke()

                    // Slight repulsion from mouse for dynamic feel
                    particles[i].vx += dxMouse * 0.0001
                    particles[i].vy += dyMouse * 0.0001

                    // Speed limit
                    const speed = Math.sqrt(particles[i].vx * particles[i].vx + particles[i].vy * particles[i].vy)
                    if (speed > 1.5) {
                        particles[i].vx = (particles[i].vx / speed) * 1.5
                        particles[i].vy = (particles[i].vy / speed) * 1.5
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render)
        }

        render()

        return () => {
            window.removeEventListener("resize", resize)
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseleave", onMouseLeave)
            cancelAnimationFrame(animationFrameId)
        }
    }, [resolvedTheme])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 pointer-events-none w-full h-full"
            style={{ opacity: 0.95 }}
        />
    )
}
