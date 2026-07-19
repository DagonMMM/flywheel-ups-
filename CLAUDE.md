# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

飞轮储能UPS系统展示网站 — 天印制造团队, a single-page industrial-themed showcase for a flywheel energy storage UPS system based on PLC control.

## Commands

No build step — this is a pure static site. Open `index.html` directly in a browser.

- **Deploy**: `git push origin main` → GitHub Pages auto-deploys to `https://dagonmmm.github.io/flywheel-ups-/`
- **Local dev**: Open `index.html` in a browser or use any static file server (e.g., `npx serve .`)

## Architecture

Single HTML file (`index.html`) with all 10 content sections, styled by one custom CSS file and two JS files:

```
index.html          # All page structure (head CDN config + 11 sections + footer)
css/style.css       # All custom styling: industrial theme, animations, mobile responsive
js/main.js          # All interactivity: particle engine, 3D tilt, parallax, flywheel sim, typewriter
js/charts.js        # Chart.js config for 4 test-data charts (speed, temp, energy curves)
```

**No framework, no build tools, no npm.** Dependencies loaded from CDN:
- Tailwind CSS (via `<script>` tag with inline `tailwind.config` — adds custom color tokens: `bg-dark`, `card-dark`, `accent`, `energy`, `warning`)
- Chart.js 4.4.0 (4 performance test charts)
- Font Awesome 6.5.1 (icons)

## Key patterns

### Color scheme (defined in Tailwind config + CSS)
- Background: `#1a1c1e`, Cards: `#25282c` / `#1f2226`, Accent: `#f59e0b` (amber), Energy: `#22c55e` (green), Warning: `#f59e0b`

### CSS class conventions
All cards share a base style of `linear-gradient(180deg, #25282c, #1f2226)` + `1px solid #33363b` border + `border-radius: 4px` + hover lift effect. Card classes: `metric-card`, `info-card`, `arch-card`, `workflow-card`, `spec-card`, `chart-container`, `safety-card`, `team-card`, `pioneer-card`, etc.

### JS interaction modules (in `main.js`)
Each effect is a standalone `init*()` function called at DOMContentLoaded:
- `createIndustrialParticles()` — fixed canvas particle engine (80 dust + 25 sparks) prepended to body
- `initTiltEffect()` / `initSimpleTilt()` — 3D perspective tilt on cards (desktop only, `pointer: fine` check)
- `initFlywheelSimulator()` — interactive canvas flywheel with drag/scroll RPM control, energy calculation (E ∝ N², calibrated to 1045J @ 8400rpm)
- `initMagneticEffect()` — magnetic cursor attraction on nav links and buttons
- `initParallax()` — hero background layers move at different scroll speeds
- `initTypewriter()` — hero subtitle types out character by character

### Scroll behavior
- Navbar gets shadow after 50px scroll, back-to-top button visible after 600px
- IntersectionObserver triggers `reveal.visible` class on cards for fade-in-up animation
- Active nav link highlighted based on scroll position (section offset detection)

### Charts (`js/charts.js`)
4 Chart.js line charts with dual Y-axes where applicable:
1. **speedChart** — charge-mode RPM curve (S-curve acceleration to 8233rpm, 15.28s)
2. **tempChart** — motor temperature (38.3°C start, ~2.96°C/min rise)
3. **energyNoLoadChart** — no-load discharge energy decay + RPM (22.81s duration)
4. **energyLoadChart** — 3.3W load discharge energy decay + RPM (20.72s duration)

Chart data is simulated from paper test results, not live data.

### Mobile responsiveness
Breakpoints at 768px and 480px in `style.css`. Mobile nav is a toggle menu (`#mobile-menu`). Hero metric cards stay 3-column even on mobile. Reveal animation delays are capped at 8 items per stagger group.

## Page sections (in scroll order)

1. **Hero** — Canvas particle background, parallax nebula layers, interactive flywheel simulator, 3 key metric cards
2. **System Overview** — Research background, system architecture diagram (4 columns: power/control/energy-storage/sensors), workflow flowchart
3. **Tech Specs** — 6 component spec cards (PLC, motor, flywheel, driver, sensors, frame)
4. **Communication & Control** — RS485 + Modbus-RTU network, device address table, PLC program highlights
5. **Slave Station** — Dual-PLC architecture (Easy-320 master + Easy-301 slave), HMI, cloud/SCADA integration, data flow diagram
6. **Performance Testing** — 4 charts, safety protection system (5 fault types)
7. **Automotive KERS** — F1/WEC flywheel history, commercial vehicle applications
8. **Aerospace** — IPACS, Flywheel-Net neural network control, space vs ground comparison
9. **Pioneers** — 4 founding members
10. **Team** — Advisors (张天宇, 路红) + core members (叶思冯, 赵鸣宇, 董庆喜)
11. **Project Info** — Cost breakdown (¥3,000 total), innovation points, achievements (paper + patent + software copyright)

## Image placeholders

All images use `.img-placeholder` (dashed border box) or `.photo-space` (circular dashed border) CSS classes. Replace by adding `<img>` tags inside these containers.
