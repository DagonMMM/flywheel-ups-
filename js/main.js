/**
 * 飞轮储能UPS系统 - 主交互脚本
 * 天印制造
 * 动态星空 · 导航高亮 · 渐入动画 · 移动菜单
 */

document.addEventListener('DOMContentLoaded', function () {

    // ============ 全局动态星空背景 ============
    function createStarfield() {
        const canvas = document.createElement('canvas');
        canvas.id = 'starfield-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let stars = [];
        const STAR_COUNT = 200;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        // 创建星星
        function createStars() {
            stars = [];
            for (let i = 0; i < STAR_COUNT; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: Math.random() * 1.8 + 0.3,          // 0.3-2.1px
                    baseAlpha: Math.random() * 0.45 + 0.12,  // 0.12-0.57 提亮
                    alpha: 0,
                    twinkleSpeed: Math.random() * 0.015 + 0.003, // 闪烁速度
                    twinkleOffset: Math.random() * Math.PI * 2,
                    colorChance: Math.random(),
                    driftX: (Math.random() - 0.5) * 0.15,  // 微漂移
                    driftY: (Math.random() - 0.5) * 0.08,
                });
            }
        }
        createStars();
        window.addEventListener('resize', createStars);

        // 动画循环
        let frame = 0;
        function animate() {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            stars.forEach(star => {
                // 正弦闪烁 + 随机微调
                const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
                const normalizedTwinkle = (twinkle + 1) / 2; // 0-1
                const flicker = 1 + (Math.sin(frame * 0.023 + star.twinkleOffset * 3)) * 0.2;
                star.alpha = star.baseAlpha * (0.3 + normalizedTwinkle * 0.7) * flicker;

                // 微漂移
                star.x += star.driftX * 0.1;
                star.y += star.driftY * 0.1;
                if (star.x < 0) star.x = canvas.width;
                if (star.x > canvas.width) star.x = 0;
                if (star.y < 0) star.y = canvas.height;
                if (star.y > canvas.height) star.y = 0;

                // 绘制
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);

                // 颜色：大部分白色，少量淡紫或淡蓝
                let color;
                if (star.colorChance < 0.15) {
                    color = `rgba(180,160,220,${star.alpha})`; // 淡紫
                } else if (star.colorChance < 0.25) {
                    color = `rgba(140,180,230,${star.alpha})`; // 淡蓝
                } else {
                    color = `rgba(255,255,255,${star.alpha})`; // 白色
                }
                ctx.fillStyle = color;

                // 亮星加光晕
                if (star.r > 1.2 && star.alpha > star.baseAlpha * 0.7) {
                    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 3);
                    glow.addColorStop(0, color);
                    glow.addColorStop(1, 'transparent');
                    ctx.fillStyle = glow;
                    ctx.arc(star.x, star.y, star.r * 3, 0, Math.PI * 2);
                }

                ctx.fill();
            });

            requestAnimationFrame(animate);
        }
        animate();
    }
    createStarfield();

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

    // ============ 移动端菜单（修复版） ============
    function openMenu() {
        mobileMenu.classList.remove('hidden');
        mobileMenuBtn.innerHTML = '<i class="fa-solid fa-xmark text-xl"></i>';
    }
    function closeMenu() {
        mobileMenu.classList.add('hidden');
        mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
    }

    mobileMenuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (mobileMenu.classList.contains('hidden')) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    // 移动菜单链接点击关闭
    const mobileMenuLinks = mobileMenu.querySelectorAll('a');
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', function () {
            closeMenu();
        });
    });

    // 点击页面其他地方关闭
    document.addEventListener('click', function (e) {
        if (!mobileMenu.classList.contains('hidden') &&
            !mobileMenu.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            closeMenu();
        }
    });

    // ============ 回到顶部 ============
    backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ============ Hero 浮动星光 ============
    function createHeroSparkles() {
        const hero = document.getElementById('hero');
        if (!hero) return;

        const container = document.createElement('div');
        container.className = 'absolute inset-0 pointer-events-none z-0';
        hero.appendChild(container);

        for (let i = 0; i < 25; i++) {
            const sparkle = document.createElement('div');
            const size = Math.random() * 3 + 1;
            sparkle.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: ${Math.random() > 0.5 ? 'rgba(200,180,255,0.6)' : 'rgba(180,210,255,0.6)'};
                animation: sparkleFloat ${Math.random() * 8 + 8}s ease-in-out infinite;
                animation-delay: ${Math.random() * 8}s;
                box-shadow: 0 0 ${size * 2}px rgba(180,160,230,0.3);
            `;
            container.appendChild(sparkle);
        }
    }
    createHeroSparkles();

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
    console.log('🌌 飞轮储能UPS系统 · 天印制造 · 宇宙星海已就绪');
});

// Hero 星光浮动动画（注入全局样式）
const sparkleStyle = document.createElement('style');
sparkleStyle.textContent = `
    @keyframes sparkleFloat {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        25% { transform: translate(30px, -40px) scale(1.5); opacity: 0.6; }
        50% { transform: translate(-20px, -80px) scale(0.8); opacity: 0.3; }
        75% { transform: translate(-40px, -30px) scale(1.3); opacity: 0.5; }
    }
`;
document.head.appendChild(sparkleStyle);
