/**
 * 飞轮储能UPS系统 - 实时监控模块
 * ============================================================
 * 通过 MQTT over WebSocket 订阅飞轮储能设备 FW001 的实时遥测数据：
 *   - 主题 flywheel/FW001/status ：每秒一帧状态 JSON
 *   - 主题 flywheel/FW001/alarms ：报警事件 JSON
 * 无硬件环境下可开启「演示模式」，由前端本地生成同格式模拟数据。
 *
 * 数据格式（论文真实体系，与上位机 flywheel_monitor 一致）：
 *   rpm / temperature(电机温度) / storage_j(储能 J) / input_voltage(输入电压 V)
 *   bus_voltage / bus_current / bus_power(母线侧，待 301 扩充，当前为 null)
 *   output_voltage / output_current(输出侧，待扩充) / mode(0待机 1充能 2储能 3输出 4故障)
 *   mode_text / energy_kwh(累计电量) / status / alarms
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

    // 告警阈值（论文真实保护体系）：超过即让仪表卡变红
    const THRESHOLDS = {
        ratedRpm: 8400,          // 额定转速（rpm）
        rpmOverspeed: 8820,      // 转速上限 = 额定 × 1.05（rpm）
        tempHigh: 70,            // 电机温度上限（°C，模拟器阶段上位机放宽到 70）
        outputVoltageLow: 20.0   // 输出电压下限（V，仅输出模式判定）
    };

    // 设备运行状态 -> 界面文案 / 样式映射
    // （上位机 status_text 取值：running/stopped/fault/warning）
    const STATUS_MAP = {
        running: { text: '运行中', light: 'lm-light--on',   textCls: 'lm-status-running' },
        stopped: { text: '已停止', light: 'lm-light--off',  textCls: 'lm-status-stopped' },
        fault:   { text: '故障',   light: 'lm-light--err',  textCls: 'lm-status-fault' },
        warning: { text: '警告',   light: 'lm-light--alarm', textCls: 'lm-status-alarm' },
        alarm:   { text: '报警',   light: 'lm-light--alarm', textCls: 'lm-status-alarm' }
    };

    // 工作模式码 -> 中文名 / 样式类（待机灰 / 充能绿闪 / 储能绿 / 输出黄 / 故障红）
    const MODE_MAP = {
        0: { text: '待机', cls: 'lm-mode-standby' },
        1: { text: '充能', cls: 'lm-mode-charge' },
        2: { text: '储能', cls: 'lm-mode-storage' },
        3: { text: '输出', cls: 'lm-mode-output' },
        4: { text: '故障', cls: 'lm-mode-fault' }
    };
    const MODE_CLASSES = ['lm-mode-standby', 'lm-mode-charge', 'lm-mode-storage',
        'lm-mode-output', 'lm-mode-fault'];

    // ============ 模块状态 ============
    const state = {
        client: null,            // MQTT 客户端实例
        connected: false,        // 是否已连接
        connecting: false,       // 是否正在连接
        manualDisconnect: false, // 是否为用户手动断开（手动断开不自动重连）
        reconnectTimer: null,    // 重连定时器
        demoMode: false,         // 演示模式开关
        demoTimer: null,         // 演示数据定时器
        demoTick: 0,             // 演示帧序号（1 帧 = 1 秒）
        frameCount: 0,           // 已接收数据帧计数
        alarmCount: 0,           // 报警计数
        // 实时曲线数据（与 Chart.js dataset 共享引用）
        chartLabels: [],
        rpmSeries: [],
        tempSeries: [],
        rpmChart: null,
        tempChart: null,
        // 演示模式数据游标（模拟慢变量）
        demo: { temp: 35.0, energyKwh: 0.0 }
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
        // 转速：> 8820（超额定 5%）判定异常
        const rpmAlarm = typeof frame.rpm === 'number' &&
            frame.rpm > THRESHOLDS.rpmOverspeed;
        setMetric('lm-card-rpm', 'lm-rpm', fmt(frame.rpm, 0), rpmAlarm);

        // 电机温度：> 70°C 判定异常（模拟器阶段上位机阈值）
        setMetric('lm-card-temp', 'lm-temp', fmt(frame.temperature, 1),
            typeof frame.temperature === 'number' && frame.temperature > THRESHOLDS.tempHigh);

        // 储能（storage_j，J）：>=1000 J 自动换算为 kJ 显示；null/缺字段显示 --
        const st = fmtStorage(frame.storage_j);
        $('lm-storage').textContent = st.text;
        $('lm-storage-unit').textContent = ' ' + st.unit;
        $('lm-card-storage').classList.remove('lm-value-alarm');

        // 输入电压（input_voltage，V）：无阈值，仅显示
        setMetric('lm-card-inpv', 'lm-input-voltage', fmt(frame.input_voltage, 1), false);

        // 输出电压：输出模式(3) 下 < 20V 判定低压异常
        const outLow = frame.mode === 3 && typeof frame.output_voltage === 'number' &&
            frame.output_voltage < THRESHOLDS.outputVoltageLow;
        setMetric('lm-card-outv', 'lm-output-voltage', fmt(frame.output_voltage, 1), outLow);

        // 工作模式卡片：文字 + 状态色（待机灰/充能绿闪/储能绿/输出黄/故障红）
        updateModeCard(frame);
    }

    /**
     * 更新工作模式卡片
     * @param {object} frame 状态帧（mode 为模式码，mode_text 为中文名）
     */
    function updateModeCard(frame) {
        const el = $('lm-mode');
        const card = $('lm-card-mode');
        const conf = MODE_MAP[frame.mode] ||
            { text: frame.mode_text || '--', cls: 'lm-mode-standby' };
        // 优先使用设备上报的 mode_text，缺失时回退到本地映射
        el.textContent = frame.mode_text || conf.text;
        MODE_CLASSES.forEach(function (c) { card.classList.remove(c); });
        card.classList.add(conf.cls);
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

    /**
     * 储能格式化：>= 1000 J 自动换算为 kJ；非法值显示 --
     * @param {number|null} v 储能（J）
     * @returns {{text: string, unit: string}} 数值文本与单位
     */
    function fmtStorage(v) {
        if (typeof v !== 'number' || !isFinite(v)) return { text: '--', unit: 'J' };
        if (Math.abs(v) >= 1000) return { text: (v / 1000).toFixed(1), unit: 'kJ' };
        return { text: v.toFixed(0), unit: 'J' };
    }

    // ============================================================
    // 5. 实时曲线（Chart.js，60 秒滚动窗口）
    //    转速曲线 + 电机温度曲线（对齐论文测试章节）
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

        // --- 转速实时曲线：琥珀铜色主线 + 8820 超速阈值虚线 ---
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
                    }, {
                        label: '超速阈值 (8820)',
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

        // --- 电机温度实时曲线：琥珀主线 + 70°C 报警阈值红色虚线 ---
        const tempCtx = $('lm-temp-chart');
        if (tempCtx) {
            state.tempChart = new Chart(tempCtx, {
                type: 'line',
                data: {
                    labels: state.chartLabels,
                    datasets: [{
                        label: '电机温度 (°C)',
                        data: state.tempSeries,
                        borderColor: '#ffab00',
                        backgroundColor: 'rgba(255, 171, 0, 0.08)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#ffab00'
                    }, {
                        label: '报警阈值 (70°C)',
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
                                label: function (ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y + ' °C'; }
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
                            title: { display: true, text: '温度 (°C)', color: tickColor },
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
        state.tempSeries.push(typeof frame.temperature === 'number' ? frame.temperature : null);

        // 超出 60 秒窗口则左移
        if (state.chartLabels.length > CHART_WINDOW) {
            state.chartLabels.shift();
            state.rpmSeries.shift();
            state.tempSeries.shift();
        }

        // 两张图的阈值虚线都需要与窗口等长
        syncThresholdLine(state.rpmChart, 1, THRESHOLDS.rpmOverspeed);
        syncThresholdLine(state.tempChart, 1, THRESHOLDS.tempHigh);

        if (state.rpmChart) state.rpmChart.update('none');
        if (state.tempChart) state.tempChart.update('none');
    }

    /**
     * 让指定图表的阈值虚线数据集与当前窗口等长
     * @param {Chart} chart 图表实例（可为 null）
     * @param {number} dsIndex 阈值虚线所在 dataset 下标
     * @param {number} value 阈值
     */
    function syncThresholdLine(chart, dsIndex, value) {
        if (!chart) return;
        const thr = chart.data.datasets[dsIndex].data;
        while (thr.length < state.chartLabels.length) thr.push(value);
        while (thr.length > state.chartLabels.length) thr.shift();
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
    //    模拟 180 秒完整工作循环（对齐论文测试流程与上位机模拟模式）：
    //    0~50s 充能(0→8400rpm) → 50~110s 储能(保持) →
    //    110~170s 输出(放电到 0，24V/3.3W) → 170~180s 待机
    // ============================================================
    function startDemoMode() {
        state.demoMode = true;
        state.demoTick = 0;
        state.demo.temp = 35.0;
        state.demo.energyKwh = 0.0;
        $('lm-demo-toggle').classList.add('lm-active');
        $('lm-mode-badge').classList.remove('hidden');
        setConnState('off', '演示模式（本地模拟数据）');
        // 每秒生成一帧与真实格式一致的模拟数据
        state.demoTimer = setInterval(function () {
            handleStatusFrame(generateDemoFrame());
            const tc = state.demoTick % 180;
            // 每个循环进入储能段时注入一条演示过热报警（阈值 70℃，模拟器阶段）
            if (tc === 60) {
                addAlarm('[演示] 电机过热：电机温度 71.0 ℃ 超过上限 70 ℃');
            }
            // 周期性注入例行自检信息，便于展示报警面板效果
            if (state.demoTick > 0 && state.demoTick % 45 === 0) {
                addAlarm('[演示] 例行自检：电参量 / 转速 / 温度读数正常');
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
     * 生成一帧演示数据：180 秒完整工作循环，格式与真实设备一致。
     * 储能 50000 J 满充（放电段线性降至 15000 J），输入电压 24V（待机归零），
     * 母线电压 220V 波动，输出侧 24V/3.3W，温度缓升缓降，电量充能段累加。
     */
    function generateDemoFrame() {
        const d = state.demo;
        state.demoTick++;
        const tc = state.demoTick % 180;  // 循环内时间（秒）

        // ---- 阶段与转速 ----
        let mode, rpm;
        if (tc < 50) {
            mode = 1;                        // 充能
            rpm = 8400 * (tc / 50);
        } else if (tc < 110) {
            mode = 2;                        // 储能
            rpm = 8400;
        } else if (tc < 170) {
            mode = 3;                        // 输出
            rpm = 8400 * (1 - (tc - 110) / 60);
        } else {
            mode = 0;                        // 待机
            rpm = 0;
        }
        if (rpm > 0) rpm += (Math.random() - 0.5) * 10;
        rpm = Math.max(0, rpm);

        // ---- 储能 storage_j（J）与输入电压 input_voltage（V）：
        //      公式与 320 模拟器一致（充能段 E∝t²，放电段线性降至 15000 J）----
        let storageJ, inputVoltage;
        if (tc < 50) {
            storageJ = 50000 * Math.pow(tc / 50, 2);
            inputVoltage = 24;
        } else if (tc < 110) {
            storageJ = 50000;
            inputVoltage = 24;
        } else if (tc < 170) {
            storageJ = 50000 - (50000 - 15000) * ((tc - 110) / 60);
            inputVoltage = 23.5;
        } else {
            storageJ = 15000;
            inputVoltage = 0;
        }

        // ---- 母线侧（电能表）----
        const busVoltage = 220 + 2 * Math.sin(state.demoTick / 30) + (Math.random() - 0.5);
        let busCurrent;
        if (mode === 1) busCurrent = 8.0 - 7.5 * (tc / 50) + (Math.random() - 0.5) * 0.2;
        else if (mode === 2) busCurrent = 0.3 + (Math.random() - 0.5) * 0.1;
        else busCurrent = 0;
        busCurrent = Math.max(0, busCurrent);
        const busPower = busVoltage * busCurrent;

        // ---- 输出侧（SK120X，输出模式 24V / ~3.3W）----
        const outputVoltage = mode === 3 ? 24 + (Math.random() - 0.5) * 0.4 : 0;
        const outputCurrent = mode === 3 ? 0.14 + (Math.random() - 0.5) * 0.02 : 0;

        // ---- 温度缓升缓降（充能/储能发热，输出/待机回落）----
        if (mode === 1 || mode === 2) d.temp += 2.5 / 60;
        else d.temp -= 0.8 / 60;
        d.temp = Math.min(55, Math.max(25, d.temp));
        const temperature = d.temp + (Math.random() - 0.5) * 0.1;

        // ---- 累计电量（充能段按母线功率累加）----
        if (mode === 1) d.energyKwh += busPower / 3.6e6;

        const running = mode === 1 || mode === 2 || mode === 3;

        return {
            timestamp: new Date().toISOString(),
            device_id: 'FW001',
            rpm: parseFloat(rpm.toFixed(1)),
            temperature: parseFloat(temperature.toFixed(1)),
            storage_j: parseFloat(storageJ.toFixed(1)),
            input_voltage: parseFloat(inputVoltage.toFixed(1)),
            bus_voltage: parseFloat(busVoltage.toFixed(1)),
            bus_current: parseFloat(busCurrent.toFixed(2)),
            bus_power: parseFloat(busPower.toFixed(1)),
            output_voltage: parseFloat(outputVoltage.toFixed(1)),
            output_current: parseFloat(outputCurrent.toFixed(2)),
            mode: mode,
            mode_text: MODE_MAP[mode].text,
            energy_kwh: parseFloat(d.energyKwh.toFixed(2)),
            status: running ? 'running' : 'stopped',
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
