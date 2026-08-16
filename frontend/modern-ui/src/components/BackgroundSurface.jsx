import React, { useRef, useEffect } from 'react'

// Canvas-based tessellation grid with subtle hover-reactive glow
export default function BackgroundSurface(){
  const ref = useRef(null)
  const mouse = useRef({x: -9999, y: -9999})

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.className = 'background-canvas'
    document.body.appendChild(canvas)
    ref.current = canvas
    const ctx = canvas.getContext('2d')

    // Headless/unsupported environments can return null; the decorative
    // backdrop is optional, so bail out rather than throwing.
    if (!ctx) {
      canvas.remove()
      return undefined
    }

    let width = 0, height = 0
    const devicePixelRatio = window.devicePixelRatio || 1

    function resize(){
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * devicePixelRatio)
      canvas.height = Math.round(height * devicePixelRatio)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)
    }

    function drawGrid(t){
      ctx.clearRect(0,0,width,height)

      // base obsidian fill
      ctx.fillStyle = '#070709'
      ctx.fillRect(0,0,width,height)

      // ambient radial spills
      const g1 = ctx.createRadialGradient(width*0.12, height*0.18, 0, width*0.12, height*0.18, 600)
      g1.addColorStop(0, 'rgba(14,165,233,0.06)')
      g1.addColorStop(1, 'rgba(14,165,233,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0,0,width,height)

      const g2 = ctx.createRadialGradient(width*0.85, height*0.78, 0, width*0.85, height*0.78, 500)
      g2.addColorStop(0, 'rgba(79,70,229,0.05)')
      g2.addColorStop(1, 'rgba(79,70,229,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0,0,width,height)

      // interactive tessellation grid
      const spacing = 56
      ctx.lineWidth = 1
      for(let x = -spacing; x < width + spacing; x += spacing){
        for(let y = -spacing; y < height + spacing; y += spacing){
          const gx = x + (Math.sin((x + t*0.0006))*4)
          const gy = y + (Math.cos((y + t*0.0004))*4)

          // compute distance to mouse
          const dx = gx - mouse.current.x
          const dy = gy - mouse.current.y
          const dist = Math.sqrt(dx*dx + dy*dy)

          let alpha = 0.03
          if(dist < 200) alpha = Math.max(0.18, 0.18 - dist/200 * 0.18)

          ctx.strokeStyle = `rgba(79,70,229,${alpha})`
          ctx.beginPath()
          ctx.moveTo(gx - 12, gy - 12)
          ctx.lineTo(gx + 12, gy + 12)
          ctx.stroke()
        }
      }

      // cursor spotlight
      if(mouse.current.x > -1){
        const grad = ctx.createRadialGradient(mouse.current.x, mouse.current.y, 0, mouse.current.x, mouse.current.y, 260)
        grad.addColorStop(0, 'rgba(14,165,233,0.12)')
        grad.addColorStop(0.4, 'rgba(79,70,229,0.06)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(mouse.current.x - 260, mouse.current.y - 260, 520, 520)
      }

      requestAnimationFrame(drawGrid)
    }

    function onMove(e){
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }

    function onLeave(){
      mouse.current.x = -9999
      mouse.current.y = -9999
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)
    resize()
    let raf = requestAnimationFrame(drawGrid)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
      canvas.remove()
    }
  }, [])

  return null
}
