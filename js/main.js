/**
 * 飞轮储能UPS系统 - 主交互脚本
 * 天印制造
 * 工业粒子背景 · 导航高亮 · 渐入动画 · 移动菜单
 */

document.addEventListener('DOMContentLoaded', function () {

    // ============ 工业粒子背景 ============
    function createIndustrialParticles() {
        const canvas = document.createElement('canvas');
        canvas.id = 'particle-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let particles = [];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        // 初始化粒子
        function initParticles() {
            particles = [];
            // 微尘粒子（多数，缓慢上浮）
            for (let i = 0; i < 80; i++) {
                particles.push({
                    type: 'dust',
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 2 + 0.5,
                    alpha: Math.random() * 0.3 + 0.08,
                    speedY: -(Math.random() * 0.4 + 0.08),
                    speedX: (Math.random() - 0.5) * 0.3,
                    color: Math.random() < 0.35 ? '200,170,120' : '160,160,160',
                    flickerPhase: Math.random() * Math.PI * 2,
                });
            }
            // 火花粒子（更多，更亮，快速上升）
            for (let i = 0; i < 25; i++) {
                particles.push({
                    type: 'spark',
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 1.8 + 0.5,
                    alpha: 0,
                    speedY: -(Math.random() * 2 + 0.8),
                    speedX: (Math.random() - 0.5) * 0.8,
                    color: '245,158,11',
                    flickerPhase: Math.random() * Math.PI * 2,
                    life: Math.floor(Math.random() * 80),
                    maxLife: Math.floor(Math.random() * 100 + 50),
                });
            }
        }
        initParticles();
        window.addEventListener('resize', initParticles);

        let frame = 0;
        function animate() {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                // 更新位置
                p.y += p.speedY;
                p.x += p.speedX;

                // 循环：超出顶部从底部重新进入
                if (p.y < -10) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                    if (p.type === 'spark') {
                        p.life = 0;
                        p.y = canvas.height * (0.6 + Math.random() * 0.4);
                    }
                }
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;

                // 计算透明度
                let alpha;
                if (p.type === 'dust') {
                    alpha = p.alpha * (0.5 + 0.5 * Math.sin(frame * 0.02 + p.flickerPhase));
                } else {
                    p.life++;
                    const lifeRatio = p.life / p.maxLife;
                    // 火花生命周期：淡入 → 高亮 → 淡出
                    if (lifeRatio < 0.1) {
                        alpha = lifeRatio / 0.1 * 0.8;
                    } else if (lifeRatio < 0.4) {
                        alpha = 0.8 * (1 - (lifeRatio - 0.1) / 0.3 * 0.2);
                    } else {
                        alpha = 0.64 * (1 - (lifeRatio - 0.4) / 0.6);
                    }
                    if (p.life >= p.maxLife) {
                        p.life = 0;
                        p.y = canvas.height * (0.5 + Math.random() * 0.5);
                        p.x = Math.random() * canvas.width;
                    }
                }

                if (alpha <= 0) return;

                // 绘制
                ctx.fillStyle = `rgba(${p.color},${alpha})`;
                if (p.type === 'spark' && alpha > 0.15) {
                    // 火花光晕（更大更亮）
                    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
                    glow.addColorStop(0, `rgba(${p.color},${alpha * 2})`);
                    glow.addColorStop(0.4, `rgba(${p.color},${alpha * 0.8})`);
                    glow.addColorStop(1, 'transparent');
                    ctx.fillStyle = glow;
                    ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);
                } else {
                    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
                }
            });

            // 更新光标光晕
            if (typeof updateCursorGlow === 'function') updateCursorGlow();

            requestAnimationFrame(animate);
        }
        animate();
    }
    createIndustrialParticles();

    // ============ DOM 元素 ============
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('back-to-top');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    // ============ 滚动监听 ============
    function onScroll() {
        const scrollY = window.scrollY;

        if (scrollY > 50) {
            navbar.classList.add('shadow-lg', 'shadow-black/20');
        } else {
            navbar.classList.remove('shadow-lg', 'shadow-black/20');
        }

        if (scrollY > 600) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }

        let currentSection = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                currentSection = '#' + section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentSection) {
                link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // ============ 滚动渐入动画 ============
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    const revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1 });
    revealElements.forEach(el => revealObserver.observe(el));

    function addRevealClasses() {
        const cards = document.querySelectorAll('.spec-card, .info-card, .arch-card, .workflow-card, .comm-feature, .code-feature-card, .chart-container, .perf-summary-card, .safety-card, .info-section-card, .metric-card, .team-card, .pioneer-card');
        cards.forEach((card, index) => {
            if (!card.classList.contains('reveal') && !card.classList.contains('reveal-left') && !card.classList.contains('reveal-right')) {
                card.classList.add('reveal');
                card.style.transitionDelay = (index % 8) * 0.06 + 's';
                revealObserver.observe(card);
            }
        });
    }
    addRevealClasses();

    // ============ 移动端菜单 ============
    let menuOpen = false;

    mobileMenuBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        menuOpen = !menuOpen;
        if (menuOpen) {
            mobileMenu.style.display = 'block';
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-xmark text-xl"></i>';
        } else {
            mobileMenu.style.display = 'none';
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        }
    };

    // 菜单内链接点击关闭
    mobileMenu.querySelectorAll('a').forEach(function(a) {
        a.onclick = function() {
            menuOpen = false;
            mobileMenu.style.display = 'none';
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        };
    });

    // 点击外部关闭
    document.addEventListener('click', function(e) {
        if (menuOpen && !mobileMenu.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
            menuOpen = false;
            mobileMenu.style.display = 'none';
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        }
    });

    // ============ 回到顶部 ============
    backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ============ Hero 工业火花粒子 ============
    function createIndustrialSparks() {
        const hero = document.getElementById('hero');
        if (!hero) return;

        const container = document.createElement('div');
        container.className = 'absolute inset-0 pointer-events-none z-0';
        hero.appendChild(container);

        for (let i = 0; i < 15; i++) {
            const spark = document.createElement('div');
            const size = Math.random() * 2 + 0.5;
            spark.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                width: ${size}px;
                height: ${size}px;
                border-radius: 0;
                background: ${Math.random() > 0.5 ? 'rgba(245,158,11,0.5)' : 'rgba(200,200,200,0.3)'};
                animation: sparkFloat ${Math.random() * 6 + 6}s ease-in-out infinite;
                animation-delay: ${Math.random() * 6}s;
            `;
            container.appendChild(spark);
        }
    }
    createIndustrialSparks();

    // ============ 数字跳动 ============
    function animateCounters() {
        const counters = document.querySelectorAll('.counter');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            if (!target) return;

            const duration = 1500;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const current = Math.floor(eased * target);

                if (counter.textContent.includes('<')) {
                    counter.textContent = '<' + current;
                } else {
                    counter.textContent = current;
                }

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            const counterObserver = new IntersectionObserver(function (entries) {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        requestAnimationFrame(update);
                        counterObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            counterObserver.observe(counter);
        });
    }
    animateCounters();

    // ============ 表格交替色 ============
    document.querySelectorAll('tbody tr').forEach((row, i) => {
        if (i % 2 === 0) row.style.background = 'rgba(255,255,255,0.01)';
    });

    // ============ 平滑滚动 ============
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = navbar.offsetHeight + 16;
                window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
            }
        });
    });

    // ============ 1. 鼠标跟随能量光晕 ============
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    let cursorGlow = null;
    let mouseX = -1000, mouseY = -1000;
    let currentX = -1000, currentY = -1000;

    if (isFinePointer) {
        cursorGlow = document.createElement('div');
        cursorGlow.id = 'cursor-glow';
        document.body.appendChild(cursorGlow);

        document.addEventListener('mousemove', function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        document.addEventListener('mouseleave', function() {
            cursorGlow.style.opacity = '0';
        });
        document.addEventListener('mouseenter', function() {
            cursorGlow.style.opacity = '1';
        });

        function updateCursorGlow() {
            if (!cursorGlow) return;
            const dx = mouseX - currentX;
            const dy = mouseY - currentY;
            currentX += dx * 0.12;
            currentY += dy * 0.12;
            cursorGlow.style.left = currentX + 'px';
            cursorGlow.style.top = currentY + 'px';
        }
    }

    // ============ 2. 3D 透视卡片倾斜 ============
    function initTiltEffect() {
        const containers = document.querySelectorAll('.tilt-container');
        if (!isFinePointer) return; // 移动端跳过

        containers.forEach(function(container) {
            const inner = container.querySelector('.tilt-inner');
            if (!inner) return;

            // 确保 container 有相对定位
            if (!container.style.position || container.style.position === 'static') {
                container.style.position = 'relative';
                container.style.overflow = 'hidden';
            }

            // 添加光晕层
            const glow = document.createElement('div');
            glow.className = 'tilt-glow';
            container.appendChild(glow);

            container.addEventListener('mouseenter', function() {
                inner.classList.remove('restoring');
            });

            container.addEventListener('mousemove', function(e) {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const percentX = (x - centerX) / centerX;
                const percentY = (y - centerY) / centerY;

                const maxAngle = 8;
                const rotateY = percentX * maxAngle;
                const rotateX = -percentY * maxAngle;

                inner.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';

                // 更新光晕位置
                glow.style.setProperty('--mx', x + 'px');
                glow.style.setProperty('--my', y + 'px');
                glow.style.opacity = '1';
            });

            container.addEventListener('mouseleave', function() {
                inner.classList.add('restoring');
                inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
                glow.style.opacity = '0';
            });
        });
    }

    // 也为没有 tilt-container 包裹的卡片做简单倾斜
    function initSimpleTilt() {
        if (!isFinePointer) return;
        const cards = document.querySelectorAll('.spec-card, .info-card, .perf-summary-card, .safety-card, .team-card, .pioneer-card');
        cards.forEach(function(card) {
            if (card.closest('.tilt-container')) return; // 已处理

            card.style.transition = 'transform 0.15s ease-out';

            card.addEventListener('mousemove', function(e) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateY = ((x - centerX) / centerX) * 5;
                const rotateX = -((y - centerY) / centerY) * 5;
                card.style.transform = 'perspective(600px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
            });

            card.addEventListener('mouseleave', function() {
                card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
                card.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                setTimeout(function() {
                    card.style.transition = 'transform 0.15s ease-out';
                }, 500);
            });
        });
    }

    // ============ 3. 飞轮转速模拟器 ============
    function initFlywheelSimulator() {
        var canvas = document.getElementById('flywheel-canvas');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var size = canvas.width;
        var cx = size / 2;
        var cy = size / 2;
        var outerR = size / 2 - 8;
        var ringR = outerR - 6;
        var hubR = 16;
        var maxRPM = 8500;
        var targetRPM = 0;
        var currentRPM = 0;
        var dragging = false;
        var angle = 0;

        var rpmEl = document.getElementById('sim-rpm');
        var energyEl = document.getElementById('sim-energy');
        var hintEl = document.getElementById('sim-hint');

        function rpmToEnergy(rpm) {
            // E ∝ N², 基于论文: 2飞轮 8400rpm → 1045J
            if (rpm < 100) return 0;
            return Math.round(1045 * Math.pow(rpm / 8400, 2));
        }

        function rpmFromAngle(a) {
            // 把角度(0~2π)映射到 0~maxRPM
            return Math.round((a % (2 * Math.PI)) / (2 * Math.PI) * maxRPM);
        }

        function drawFlywheel(rpm, rotation) {
            ctx.clearRect(0, 0, size, size);

            var intensity = rpm / maxRPM;
            var glowAlpha = 0.05 + intensity * 0.4;
            var ringGlow = 0.1 + intensity * 0.6;

            // 外发光
            if (rpm > 200) {
                var glowGrad = ctx.createRadialGradient(cx, cy, outerR * 0.7, cx, cy, outerR * 1.6);
                glowGrad.addColorStop(0, 'rgba(245,158,11,' + glowAlpha + ')');
                glowGrad.addColorStop(0.5, 'rgba(245,158,11,' + (glowAlpha * 0.4) + ')');
                glowGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, outerR * 1.6, 0, Math.PI * 2);
                ctx.fill();
            }

            // 飞轮盘体
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);

            // 金属盘面
            var diskGrad = ctx.createRadialGradient(0, 0, hubR, 0, 0, outerR);
            diskGrad.addColorStop(0, '#4a4d52');
            diskGrad.addColorStop(0.3, '#3a3d42');
            diskGrad.addColorStop(0.7, '#2d3035');
            diskGrad.addColorStop(1, '#25282c');
            ctx.fillStyle = diskGrad;
            ctx.beginPath();
            ctx.arc(0, 0, outerR, 0, Math.PI * 2);
            ctx.fill();

            // 外圈
            ctx.strokeStyle = 'rgba(200,200,200,' + (0.3 + intensity * 0.5) + ')';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.stroke();

            // 能量光环
            if (rpm > 500) {
                var energyGlow = ctx.createRadialGradient(0, 0, ringR, 0, 0, outerR);
                energyGlow.addColorStop(0, 'rgba(245,158,11,0)');
                energyGlow.addColorStop(0.5, 'rgba(245,158,11,' + ringGlow + ')');
                energyGlow.addColorStop(1, 'rgba(245,158,11,0)');
                ctx.strokeStyle = energyGlow;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(0, 0, ringR + 2, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 辐条 (6根)
            for (var s = 0; s < 6; s++) {
                var spokeAngle = (s / 6) * Math.PI * 2;
                ctx.save();
                ctx.rotate(spokeAngle);
                ctx.strokeStyle = 'rgba(180,180,180,' + (0.2 + intensity * 0.2) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(hubR + 2, 0);
                ctx.lineTo(ringR - 2, 0);
                ctx.stroke();
                ctx.restore();
            }

            // 轮毂
            var hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hubR);
            hubGrad.addColorStop(0, '#6a6d72');
            hubGrad.addColorStop(0.6, '#4a4d52');
            hubGrad.addColorStop(1, '#35383d');
            ctx.fillStyle = hubGrad;
            ctx.beginPath();
            ctx.arc(0, 0, hubR, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, hubR, 0, Math.PI * 2);
            ctx.stroke();

            // 中心点
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // 转速刻度弧
            if (rpm > 0) {
                var arcStart = -Math.PI / 2;
                var arcEnd = arcStart + (rpm / maxRPM) * (2 * Math.PI);
                ctx.strokeStyle = 'rgba(245,158,11,' + (0.6 + intensity * 0.3) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, outerR + 4, arcStart, arcEnd);
                ctx.stroke();

                // 端点小亮点
                var ex = cx + (outerR + 4) * Math.cos(arcEnd);
                var ey = cy + (outerR + 4) * Math.sin(arcEnd);
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(ex, ey, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function updateSim() {
            // 平滑接近目标
            var diff = targetRPM - currentRPM;
            if (Math.abs(diff) < 5) {
                currentRPM = targetRPM;
            } else {
                currentRPM += diff * 0.12;
            }
            var rpm = Math.round(currentRPM);

            // 旋转角度 (转速越高转得越快)
            var rotSpeed = rpm / 1000 * 0.05;
            angle += rotSpeed;

            drawFlywheel(rpm, angle);

            rpmEl.textContent = rpm;
            energyEl.textContent = rpmToEnergy(rpm);

            requestAnimationFrame(updateSim);
        }

        function setRPMFromPointer(e) {
            var rect = canvas.getBoundingClientRect();
            var x = e.clientX - rect.left - rect.width / 2;
            var y = e.clientY - rect.top - rect.height / 2;
            var a = Math.atan2(y, x);
            if (a < 0) a += 2 * Math.PI;
            targetRPM = rpmFromAngle(a);
        }

        // 鼠标交互
        canvas.addEventListener('mousedown', function(e) {
            dragging = true;
            setRPMFromPointer(e);
            if (hintEl) hintEl.style.opacity = '0';
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            setRPMFromPointer(e);
        });

        window.addEventListener('mouseup', function() {
            dragging = false;
            canvas.style.cursor = 'grab';
        });

        // 滚轮
        canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            if (hintEl) hintEl.style.opacity = '0';
            var delta = e.deltaY > 0 ? -300 : 300;
            targetRPM = Math.max(0, Math.min(maxRPM, targetRPM + delta));
        }, { passive: false });

        // 触摸交互
        canvas.addEventListener('touchstart', function(e) {
            e.preventDefault();
            dragging = true;
            setRPMFromPointer(e.touches[0]);
            if (hintEl) hintEl.style.opacity = '0';
        });

        canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
            if (!dragging) return;
            setRPMFromPointer(e.touches[0]);
        });

        canvas.addEventListener('touchend', function() {
            dragging = false;
        });

        // 初始绘制
        drawFlywheel(0, 0);
        requestAnimationFrame(updateSim);
    }

    // ============ 4. 磁吸按钮效果 ============
    function initMagneticEffect() {
        if (!isFinePointer) return;

        var targets = document.querySelectorAll('.nav-link, #back-to-top, .workflow-card, .code-feature-card');
        targets.forEach(function(el) {
            el.classList.add('magnetic-target');

            // 包裹文字内容
            if (!el.querySelector('.magnetic-inner') && el.children.length <= 1) {
                var children = Array.from(el.childNodes);
                var wrapper = document.createElement('span');
                wrapper.className = 'magnetic-inner';
                wrapper.style.display = 'inline-block';
                children.forEach(function(c) { wrapper.appendChild(c); });
                el.appendChild(wrapper);
            }

            var inner = el.querySelector('.magnetic-inner');
            el.addEventListener('mousemove', function(e) {
                var rect = el.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                var dist = Math.sqrt(x * x + y * y);
                var threshold = 80;
                if (dist < threshold) {
                    var power = (1 - dist / threshold) * 8;
                    var moveX = (x / dist) * power;
                    var moveY = (y / dist) * power;
                    el.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px)';
                    if (inner) {
                        inner.style.transform = 'translate(' + (-moveX * 0.3) + 'px, ' + (-moveY * 0.3) + 'px)';
                    }
                }
            });

            el.addEventListener('mouseleave', function() {
                el.style.transform = 'translate(0, 0)';
                if (inner) inner.style.transform = 'translate(0, 0)';
            });
        });
    }

    // ============ 5. 滚动视差 ============
    function initParallax() {
        var layers = document.querySelectorAll('.parallax-layer');
        if (!layers.length) return;

        function updateParallax() {
            var scrollY = window.scrollY;
            var hero = document.getElementById('hero');
            if (!hero) return;
            var heroHeight = hero.offsetHeight;
            if (scrollY > heroHeight) return; // 超出Hero则不计算

            layers.forEach(function(layer) {
                var speed = parseFloat(layer.getAttribute('data-parallax-speed')) || 0.5;
                var offset = scrollY * speed;
                layer.style.transform = 'translateY(' + offset + 'px)';
            });
        }

        window.addEventListener('scroll', updateParallax, { passive: true });
        updateParallax();
    }

    // ============ 6. 打字机副标题 ============
    function initTypewriter() {
        var subtitle = document.getElementById('hero-subtitle');
        if (!subtitle) return;

        var fullText = subtitle.textContent.trim();
        subtitle.textContent = '';
        subtitle.style.visibility = 'visible';

        var cursor = document.createElement('span');
        cursor.className = 'typewriter-cursor';

        var i = 0;
        function typeNext() {
            if (i < fullText.length) {
                subtitle.textContent += fullText.charAt(i);
                i++;
                setTimeout(typeNext, 55 + Math.random() * 30);
            } else {
                // 打字完成，添加光标闪烁
                subtitle.appendChild(cursor);
                // 3秒后移除光标
                setTimeout(function() {
                    if (cursor.parentNode) {
                        cursor.style.opacity = '0';
                        cursor.style.transition = 'opacity 0.5s';
                        setTimeout(function() {
                            if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
                        }, 600);
                    }
                }, 3000);
            }
        }

        // 延迟启动
        setTimeout(typeNext, 600);
    }

    // ============ 初始化所有交互效果 ============
    initTiltEffect();
    initSimpleTilt();
    initFlywheelSimulator();
    initMagneticEffect();
    initParallax();
    initTypewriter();

    onScroll();
    console.log('🏭 飞轮储能UPS系统 · 天印制造 · 工业粒子引擎已就绪');
});

// 工业火花浮动动画
const sparkStyle = document.createElement('style');
sparkStyle.textContent = `
    @keyframes sparkFloat {
        0%, 100% { transform: translate(0, 0); opacity: 0; }
        20% { opacity: 0.7; }
        50% { transform: translate(20px, -60px); opacity: 0.4; }
        80% { opacity: 0.1; }
    }
    @keyframes industrialSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(sparkStyle);
