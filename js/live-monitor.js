/**
 * 飞轮储能UPS系统 - 实时监控模块
 * ============================================================
 * 通过 MQTT over WebSocket 订阅飞轮储能设备 FW001 的实时遥测数据：
 *   - 主题 flywheel/FW001/status ：每秒一帧状态 JSON
 *   - 主题 flywheel/FW001/alarms ：报警事件 JSON
 * 无硬件环境下可开启「演示模式」，由前端本地生成同格式模拟数据。
 *
 * 结构与 main.js 保持一致：DOMContentLoaded 时统一初始化，
 * 每个子功能封装为独立的 init*() / 功能函数。
 * 依赖：Chart.js（charts.js 已加载）、MQTT.js（mqtt.min.js）。
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', function () {

    // 页面不包含实时监控区块时直接退出，避免影响其它页面
    if (!document.getElementById('live-monitor')) return;

    // ============ 常量配置 ============
    const TOPIC_STATUS = 'flywheel/FW001/status';   // 状态数据主题
    const TOPIC_ALARMS = 'flywheel/FW001/alarms';   // 报警事件主题
    const DEFAULT_BROKER = 'wss://broker.emqx.io:8084/mqtt'; // 默认公共测试 Broker
    const LS_KEY_BROKER = 'flywheel.monitor.brokerUrl';      // localStorage 键
    const RECONNECT_DELAY = 5000;   // 断线自动重连间隔（毫秒）
    const CHART_WINDOW = 60;        // 实时曲线滚动窗口长度（秒，1 帧/秒）
    const MAX_ALARMS = 50;          // 报警列表最多保留条数

    // 告警阈值：超过即让仪表卡变红
    const THRESHOLDS = {
        rpmHigh: 28000,   // 转速上限（rpm）
        rpmLow: 500,      // 转速下限（仅运行状态时判定）
        tempHigh: 80,     // 温度上限（°C）
        vibHigh: 10,      // 振动上限（g）
        currentHigh: 50   // 电流上限（A）
    };

    // 设备运行状态 -> 界面文案 / 样式映射
    const STATUS_MAP = {
        running: { text: '运行中', light: 'lm-light--on',   textCls: 'lm-status-running' },
        stopped: { text: '已停止', light: 'lm-light--off',  textCls: 'lm-status-stopped' },
        fault:   { text: '故障',   light: 'lm-light--err',  textCls: 'lm-status-fault' },
        alarm:   { text: '报警',   light: 'lm-light--alarm', textCls: 'lm-status-alarm' }
    };

    // ============ 模块状态 ============
    const state = {
        client: null,            // MQTT 客户端实例
        connected: false,        // 是否已连接
        connecting: false,       // 是否正在连接
        manualDisconnect: false, // 是否为用户手动断开（手动断开不自动重连）
        reconnectTimer: null,    // 重连定时器
        demoMode: false,         // 演示模式开关
        demoTimer: null,         // 演示数据定时器
        demoTick: 0,             // 演示帧序号
        frameCount: 0,           // 已接收数据帧计数
        alarmCount: 0,           // 报警计数
        // 实时曲线数据（与 Chart.js dataset 共享引用）
        chartLabels: [],
        rpmSeries: [],
        vibXSeries: [],
        vibYSeries: [],
        rpmChart: null,
        vibChart: null,
        // 演示模式数据游标（缓慢波动用）
        demo: { rpm: 11500, temp: 42.0 }
    };

    /** 简写：按 id 取元素 */
    function $(id) { return document.getElementById(id); }

    // ============================================================
    // 1. 连接配置条
    // ============================================================
    function initConfigBar() {
        // 从 localStorage 恢复上次使用的 Broker 地址
        const input = $('lm-broker-url');
        const saved = localStorage.getItem(LS_KEY_BROKER);
        input.value = saved || DEFAULT_BROKER;

        $('lm-connect-btn').addEventListener('click', function () {
            // 演示模式与 MQTT 模式互斥：连接前自动关闭演示模式
            if (state.demoMode) stopDemoMode();
            connect();
        });
        $('lm-disconnect-btn').addEventListener('click', function () {
            disconnect(true);
        });
        $('lm-demo-toggle').addEventListener('click', function () {
            if (state.demoMode) {
                stopDemoMode();
            } else {
                // 互斥：开启演示前先断开 MQTT
                if (state.client) disconnect(true);
                startDemoMode();
            }
        });
        $('lm-clear-alarms').addEventListener('click', clearAlarms);

        // 输入框失焦时持久化地址
        input.addEventListener('change', function () {
            localStorage.setItem(LS_KEY_BROKER, input.value.trim());
        });

        setConnState('off', '未连接');
    }

    /**
     * 更新连接状态指示灯与按钮可用性
     * @param {'on'|'connecting'|'err'|'off'} s 连接状态
     * @param {string} text 状态文案
     */
    function setConnState(s, text) {
        const light = $('lm-conn-light');
        light.className = 'lm-light lm-light--' + s;
        $('lm-conn-status').textContent = text;
        $('lm-connect-btn').disabled = (s === 'on' || s === 'connecting');
        $('lm-disconnect-btn').disabled = (s !== 'on' && s !== 'connecting');
    }

    // ============================================================
    // 2. MQTT 连接管理
    // ============================================================
    function connect() {
        // MQTT.js 未加载（离线/CDN 失败）时给出明确提示
        if (typeof mqtt === 'undefined') {
            setConnState('err', 'MQTT 库未加载');
            addAlarm('[前端] mqtt.min.js 加载失败，请检查网络后刷新页面');
            return;
        }

        const url = ($('lm-broker-url').value || DEFAULT_BROKER).trim();
        localStorage.setItem(LS_KEY_BROKER, url);

        state.manualDisconnect = false;
        state.connecting = true;
        setConnState('connecting', '连接中…');

        // 关闭内置自动重连，由本模块统一按 5 秒间隔重连
        state.client = mqtt.connect(url, {
            reconnectPeriod: 0,
            connectTimeout: 8000,
            clientId: 'fw-web-' + Math.random().toString(16).slice(2, 10)
        });

        state.client.on('connect', function () {
            state.connected = true;
            state.connecting = false;
            setConnState('on', '已连接');
            // 订阅状态与报警两个主题
            state.client.subscribe([TOPIC_STATUS, TOPIC_ALARMS], function (err) {
                if (err) addAlarm('[前端] 主题订阅失败：' + err.message);
            });
        });

        state.client.on('message', handleMessage);

        state.client.on('error', function (err) {
            console.warn('MQTT 错误：', err);
        });

        // 连接关闭：若非手动断开且不在演示模式，则 5 秒后自动重连
        state.client.on('close', function () {
            state.connected = false;
            state.connecting = false;
            if (!state.manualDisconnect && !state.demoMode) {
                setConnState('err', '已断开，5 秒后重连…');
                scheduleReconnect();
            } else {
                setConnState('off', '未连接');
            }
        });
    }

    /**
     * 断开连接
     * @param {boolean} manual 是否用户手动触发
     */
    function disconnect(manual) {
        state.manualDisconnect = !!manual;
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        if (state.client) {
            state.client.end(true);
            state.client = null;
        }
        state.connected = false;
        state.connecting = false;
        setConnState('off', '未连接');
    }

    /** 安排 5 秒后的自动重连 */
    function scheduleReconnect() {
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
        state.reconnectTimer = setTimeout(function () {
            state.reconnectTimer = null;
            if (!state.connected && !state.demoMode) connect();
        }, RECONNECT_DELAY);
    }

    // ============================================================
    // 3. 消息处理
    // ============================================================
    /**
     * MQTT 消息入口
     * @param {string} topic 主题
     * @param {Buffer|Uint8Array} payload 原始报文
     */
    function handleMessage(topic, payload) {
        const text = payload.toString();
        if (topic === TOPIC_STATUS) {
            let frame;
            try {
                frame = JSON.parse(text);
            } catch (e) {
                console.warn('状态帧 JSON 解析失败：', text);
                return;
            }
            handleStatusFrame(frame);
        } else if (topic === TOPIC_ALARMS) {
            handleAlarmPayload(text);
        }
    }

    /**
     * 处理一帧状态数据：更新仪表、状态灯、曲线与计数
     * @param {object} frame 状态 JSON 对象
     */
    function handleStatusFrame(frame) {
        // 帧计数与最后数据时间
        state.frameCount++;
        $('lm-frame-count').textContent = state.frameCount;
        const t = frame.timestamp ? new Date(frame.timestamp) : new Date();
        $('lm-last-time').textContent = isNaN(t)
            ? String(frame.timestamp)
            : t.toLocaleString('zh-CN', { hour12: false });

        updateMetrics(frame);
        updateStatusIndicator(frame.status);
        pushChartPoint(frame);

        // 状态帧内携带的报警数组也进入报警面板
        if (Array.isArray(frame.alarms)) {
            frame.alarms.forEach(function (a) {
                addAlarm(typeof a === 'string' ? a : JSON.stringify(a));
            });
        }
    }

    /**
     * 处理报警主题报文：兼容数组 / {alarms:[...]} / {message} / 纯文本
     * @param {string} text 报文文本
     */
    function handleAlarmPayload(text) {
        let items = [];
        try {
            const p = JSON.parse(text);
            if (Array.isArray(p)) items = p;
            else if (Array.isArray(p.alarms)) items = p.alarms;
            else items = [p.message || p.msg || JSON.stringify(p)];
        } catch (e) {
            items = [text];
        }
        items.forEach(function (a) {
            addAlarm(typeof a === 'string' ? a : JSON.stringify(a));
        });
    }

    // ============================================================
    // 4. 大数字仪表卡（含阈值变红）
    // ============================================================
    function updateMetrics(frame) {
        const running = frame.status === 'running';

        // 转速：> 28000 或运行时 < 500 判定异常
        const rpmAlarm = typeof frame.rpm === 'number' &&
            (frame.rpm > THRESHOLDS.rpmHigh || (running && frame.rpm < THRESHOLDS.rpmLow));
        setMetric('lm-card-rpm', 'lm-rpm', fmt(frame.rpm, 0), rpmAlarm);

        // 温度：> 80°C 判定异常
        setMetric('lm-card-temp', 'lm-temp', fmt(frame.temperature, 1),
            typeof frame.temperature === 'number' && frame.temperature > THRESHOLDS.tempHigh);

        // 电流：> 50A 判定异常
        setMetric('lm-card-current', 'lm-current', fmt(frame.current, 1),
            typeof frame.current === 'number' && frame.current > THRESHOLDS.currentHigh);

        // 振动 X / Y：> 10g 判定异常
        setMetric('lm-card-vibx', 'lm-vib-x', fmt(frame.vibration_x, 2),
            typeof frame.vibration_x === 'number' && frame.vibration_x > THRESHOLDS.vibHigh);
        setMetric('lm-card-viby', 'lm-vib-y', fmt(frame.vibration_y, 2),
            typeof frame.vibration_y === 'number' && frame.vibration_y > THRESHOLDS.vibHigh);
    }

    /**
     * 写入单个仪表卡数值并切换告警样式
     * @param {string} cardId 卡片元素 id
     * @param {string} valueId 数值元素 id
     * @param {string} text 显示文本
     * @param {boolean} alarm 是否超阈值
     */
    function setMetric(cardId, valueId, text, alarm) {
        $(valueId).textContent = text;
        $(cardId).classList.toggle('lm-value-alarm', !!alarm);
    }

    /** 数字格式化：非法值显示 -- */
    function fmt(v, digits) {
        return (typeof v === 'number' && isFinite(v)) ? v.toFixed(digits) : '--';
    }

    // ============================================================
    // 5. 实时曲线（Chart.js，60 秒滚动窗口）
    // ============================================================
    function initLiveCharts() {
        // Chart.js 未加载时跳过图表，其余功能不受影响
        if (typeof Chart === 'undefined') return;

        const gridColor = 'rgba(255,255,255,0.06)';
        const tickColor = '#6b7280';
        const legendOpts = {
            position: 'top',
            labels: { usePointStyle: true, padding: 20, color: '#9ca3af', font: { size: 11 } }
        };

        // --- 转速实时曲线：琥珀铜色主线，与全站 accent 一致 ---
        const rpmCtx = $('lm-rpm-chart');
        if (rpmCtx) {
            state.rpmChart = new Chart(rpmCtx, {
                type: 'line',
                data: {
                    labels: state.chartLabels,
                    datasets: [{
                        label: '飞轮转速 (rpm)',
                        data: state.rpmSeries,
                        borderColor: '#D4874A',
                        backgroundColor: 'rgba(212, 135, 74, 0.10)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#D4874A'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: false, // 每秒刷新，关闭动画避免闪烁
                    plugins: {
                        legend: legendOpts,
                        tooltip: {
                            callbacks: {
                                label: function (ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + ' rpm'; }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 8 },
                            title: { display: true, text: '时间（最近 60 秒）', color: tickColor }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 10 } },
                            title: { display: true, text: '转速 (rpm)', color: tickColor },
                            min: 0
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }

        // --- 振动 X/Y 实时曲线：青 / 绿双主线，与既有图表配色一致 ---
        const vibCtx = $('lm-vib-chart');
        if (vibCtx) {
            state.vibChart = new Chart(vibCtx, {
                type: 'line',
                data: {
                    labels: state.chartLabels,
                    datasets: [{
                        label: '振动 X (g)',
                        data: state.vibXSeries,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.08)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#00d4ff'
                    }, {
                        label: '振动 Y (g)',
                        data: state.vibYSeries,
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.06)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#00ff88'
                    }, {
                        label: '报警阈值 (10g)',
                        data: [], // 长度随窗口同步补齐
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        borderWidth: 1.5,
                        borderDash: [8, 4],
                        fill: false,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: false,
                    plugins: {
                        legend: legendOpts,
                        tooltip: {
                            callbacks: {
                                label: function (ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + ' g'; }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 8 },
                            title: { display: true, text: '时间（最近 60 秒）', color: tickColor }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 10 } },
                            title: { display: true, text: '振动 (g)', color: tickColor },
                            min: 0
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }
    }

    /**
     * 向滚动窗口压入一帧曲线数据（页面隐藏时 MQTT 仍在收数据，
     * 曲线会在页面恢复显示时呈现完整连续窗口）
     * @param {object} frame 状态帧
     */
    function pushChartPoint(frame) {
        const t = frame.timestamp ? new Date(frame.timestamp) : new Date();
        const label = isNaN(t) ? '--:--:--' : t.toLocaleTimeString('zh-CN', { hour12: false });

        state.chartLabels.push(label);
        state.rpmSeries.push(typeof frame.rpm === 'number' ? frame.rpm : null);
        state.vibXSeries.push(typeof frame.vibration_x === 'number' ? frame.vibration_x : null);
        state.vibYSeries.push(typeof frame.vibration_y === 'number' ? frame.vibration_y : null);

        // 超出 60 秒窗口则左移
        if (state.chartLabels.length > CHART_WINDOW) {
            state.chartLabels.shift();
            state.rpmSeries.shift();
            state.vibXSeries.shift();
            state.vibYSeries.shift();
        }

        // 振动图的阈值虚线需要与窗口等长
        if (state.vibChart) {
            const thr = state.vibChart.data.datasets[2].data;
            while (thr.length < state.chartLabels.length) thr.push(THRESHOLDS.vibHigh);
            while (thr.length > state.chartLabels.length) thr.shift();
        }

        if (state.rpmChart) state.rpmChart.update('none');
        if (state.vibChart) state.vibChart.update('none');
    }

    // ============================================================
    // 6. 运行状态指示
    // ============================================================
    function updateStatusIndicator(status) {
        const conf = STATUS_MAP[status] || { text: '未知', light: 'lm-light--off', textCls: '' };
        const light = $('lm-status-light');
        light.className = 'lm-light ' + conf.light;
        const textEl = $('lm-status-text');
        textEl.textContent = conf.text + (status ? '（' + status + '）' : '');
        textEl.className = 'lm-status-text ' + conf.textCls;
    }

    // ============================================================
    // 7. 报警面板
    // ============================================================
    /**
     * 追加一条报警（最新在顶部），并触发面板闪烁提示
     * @param {string} msg 报警内容
     */
    function addAlarm(msg) {
        const list = $('lm-alarm-list');
        const empty = $('lm-alarm-empty');
        if (empty) empty.remove();

        const li = document.createElement('li');
        li.className = 'lm-alarm-item';
        const timeEl = document.createElement('time');
        timeEl.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const msgEl = document.createElement('span');
        msgEl.textContent = msg; // textContent 防止注入
        li.appendChild(timeEl);
        li.appendChild(msgEl);
        list.prepend(li);

        // 限制列表长度
        while (list.children.length > MAX_ALARMS) list.removeChild(list.lastChild);

        // 更新角标计数
        state.alarmCount++;
        const badge = $('lm-alarm-count');
        badge.textContent = state.alarmCount;
        badge.classList.remove('hidden');

        // 面板闪烁提示（重启动画）
        const panel = $('lm-alarm-panel');
        panel.classList.remove('lm-flash');
        void panel.offsetWidth; // 强制 reflow
        panel.classList.add('lm-flash');
    }

    /** 清空报警列表与角标 */
    function clearAlarms() {
        const list = $('lm-alarm-list');
        list.innerHTML = '';
        const li = document.createElement('li');
        li.id = 'lm-alarm-empty';
        li.className = 'lm-alarm-empty';
        li.textContent = '暂无报警';
        list.appendChild(li);
        state.alarmCount = 0;
        $('lm-alarm-count').classList.add('hidden');
    }

    // ============================================================
    // 8. 演示模式（与 MQTT 模式互斥）
    // ============================================================
    function startDemoMode() {
        state.demoMode = true;
        state.demoTick = 0;
        $('lm-demo-toggle').classList.add('lm-active');
        $('lm-mode-badge').classList.remove('hidden');
        setConnState('off', '演示模式（本地模拟数据）');
        // 每秒生成一帧与真实格式一致的模拟数据
        state.demoTimer = setInterval(function () {
            handleStatusFrame(generateDemoFrame());
            // 周期性注入一条演示报警，便于展示报警面板效果
            if (state.demoTick > 0 && state.demoTick % 45 === 0) {
                addAlarm('[演示] 例行自检：各传感器读数正常');
            }
        }, 1000);
    }

    function stopDemoMode() {
        state.demoMode = false;
        if (state.demoTimer) {
            clearInterval(state.demoTimer);
            state.demoTimer = null;
        }
        $('lm-demo-toggle').classList.remove('lm-active');
        $('lm-mode-badge').classList.add('hidden');
        setConnState('off', '未连接');
    }

    /**
     * 生成一帧演示数据：转速在 8000~15000rpm 间缓慢波动，
     * 温度缓升震荡，振动/电流小幅随机，格式与真实设备一致。
     */
    function generateDemoFrame() {
        const d = state.demo;
        state.demoTick++;

        // 转速：随机游走 + 低频正弦，夹在 8000~15000
        d.rpm += (Math.random() - 0.5) * 500 + Math.sin(state.demoTick / 12) * 150;
        d.rpm = Math.min(15000, Math.max(8000, d.rpm));

        // 温度：38~56°C 缓慢漂移
        d.temp += (Math.random() - 0.45) * 0.35;
        d.temp = Math.min(56, Math.max(38, d.temp));

        // 振动：1~5g 之间波动，Y 轴略小于 X 轴
        const vibX = 1.5 + Math.random() * 2.2 + Math.abs(Math.sin(state.demoTick / 9));
        const vibY = vibX * (0.6 + Math.random() * 0.3);

        return {
            timestamp: new Date().toISOString(),
            device_id: 'FW001',
            rpm: parseFloat(d.rpm.toFixed(1)),
            temperature: parseFloat(d.temp.toFixed(1)),
            vibration_x: parseFloat(vibX.toFixed(2)),
            vibration_y: parseFloat(vibY.toFixed(2)),
            current: parseFloat((8 + Math.random() * 9).toFixed(1)),
            status: 'running',
            alarms: []
        };
    }

    // ============================================================
    // 初始化入口（与 main.js 风格一致）
    // ============================================================
    initConfigBar();
    initLiveCharts();
    console.log('📡 实时监控模块已加载（MQTT over WebSocket / 演示模式）');
});
