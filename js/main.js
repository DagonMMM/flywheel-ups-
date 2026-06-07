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
