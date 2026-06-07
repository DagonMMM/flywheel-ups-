/**
 * 飞轮储能UPS系统 - 主交互脚本
 * 滚动监听、导航高亮、渐入动画、移动菜单、回到顶部等
 */

document.addEventListener('DOMContentLoaded', function () {

    // ============ DOM 元素 ============
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('back-to-top');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileNavLinks = mobileMenu.querySelectorAll('a');
    const sections = document.querySelectorAll('section[id]');

    // ============ 滚动监听：导航栏样式 + 回到顶部 ============
    let lastScrollY = 0;

    function onScroll() {
        const scrollY = window.scrollY;

        // 导航栏阴影
        if (scrollY > 50) {
            navbar.classList.add('shadow-lg', 'shadow-black/20');
        } else {
            navbar.classList.remove('shadow-lg', 'shadow-black/20');
        }

        // 回到顶部按钮
        if (scrollY > 600) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }

        // 当前 section 高亮
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

        lastScrollY = scrollY;
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // ============ 滚动渐入动画 (Intersection Observer) ============
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => revealObserver.observe(el));

    // 为关键元素自动添加 reveal 类
    function addRevealClasses() {
        const cards = document.querySelectorAll('.spec-card, .info-card, .arch-card, .workflow-card, .comm-feature, .code-feature-card, .chart-container, .perf-summary-card, .safety-card, .info-section-card, .metric-card');
        cards.forEach((card, index) => {
            if (!card.classList.contains('reveal') && !card.classList.contains('reveal-left') && !card.classList.contains('reveal-right')) {
                card.classList.add('reveal');
                card.style.transitionDelay = (index % 6) * 0.08 + 's';
                revealObserver.observe(card);
            }
        });
    }
    addRevealClasses();

    // ============ 移动端菜单 ============
    mobileMenuBtn.addEventListener('click', function () {
        const isOpen = !mobileMenu.classList.contains('hidden');
        if (isOpen) {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        } else {
            mobileMenu.classList.remove('hidden');
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-xmark text-xl"></i>';
        }
    });

    // 移动菜单点击后关闭
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function () {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        });
    });

    // 点击页面其他区域关闭移动菜单
    document.addEventListener('click', function (e) {
        if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        }
    });

    // ============ 回到顶部 ============
    backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ============ Hero 粒子特效 ============
    function createParticles() {
        const hero = document.getElementById('hero');
        if (!hero) return;

        const particleContainer = document.createElement('div');
        particleContainer.className = 'absolute inset-0 pointer-events-none z-0';
        hero.appendChild(particleContainer);

        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 6 + 4) + 's';
            if (Math.random() > 0.5) {
                particle.style.background = '#00ff88';
            }
            particleContainer.appendChild(particle);
        }
    }
    createParticles();

    // ============ 指标数字跳动动画 ============
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
                // easeOutExpo
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

            // 当元素进入视口时才开始动画
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

    // ============ 表格行交替颜色 ============
    const tableRows = document.querySelectorAll('tbody tr');
    tableRows.forEach((row, index) => {
        if (index % 2 === 0) {
            row.style.background = 'rgba(255,255,255,0.01)';
        }
    });

    // ============ 导航平滑滚动 (确保 hash 链接平滑) ============
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = navbar.offsetHeight + 20;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });

    // 初始滚动状态检查
    onScroll();

    console.log('🚀 飞轮储能UPS系统网站已就绪');
    console.log('   PLC控制 · 100ms无缝切换 · 1045J储能');
});
