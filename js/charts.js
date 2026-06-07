/**
 * 飞轮储能UPS系统 - 图表配置
 * 基于论文实验数据，使用 Chart.js 绘制测试曲线
 */

document.addEventListener('DOMContentLoaded', function () {

    // ============ 通用 Chart.js 配置 ============
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    Chart.defaults.font.family = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';

    const gridColor = 'rgba(255,255,255,0.06)';
    const tickColor = '#6b7280';

    // ============ 1. 充能模式飞轮转速曲线 ============
    (function () {
        const ctx = document.getElementById('speedChart');
        if (!ctx) return;

        // 模拟数据：加速阶段(0-15.28s) + 稳态阶段(15.28-30s)
        const labels = [];
        const speedData = [];
        const targetSpeed = 8200;

        // 0-16s: S曲线加速 (模拟斜坡加速)
        for (let t = 0; t <= 16; t += 0.5) {
            labels.push(t.toFixed(1) + 's');
            if (t <= 15.28) {
                // S曲线加速
                const progress = t / 15.28;
                const speed = targetSpeed * (1 / (1 + Math.exp(-12 * (progress - 0.5))));
                speedData.push(Math.round(speed));
            } else {
                // 稳态区间（微幅震荡）
                const baseSpeed = 8233 + Math.sin(t * 0.8) * 30 + (Math.random() - 0.5) * 20;
                speedData.push(Math.round(baseSpeed));
            }
        }

        // 16-30s: 稳态延长
        for (let t = 16.5; t <= 30; t += 0.5) {
            labels.push(t.toFixed(1) + 's');
            const baseSpeed = 8233 + Math.sin(t * 0.8) * 30 + (Math.random() - 0.5) * 15;
            speedData.push(Math.round(Math.min(Math.max(baseSpeed, 8200), 8290)));
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '飞轮转速 (rpm)',
                    data: speedData,
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.08)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#00d4ff',
                }, {
                    label: '目标转速 (8200rpm)',
                    data: Array(labels.length).fill(targetSpeed),
                    borderColor: 'rgba(0, 255, 136, 0.4)',
                    borderWidth: 1.5,
                    borderDash: [8, 4],
                    fill: false,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#9ca3af',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.dataset.label + ': ' + ctx.parsed.y + ' rpm';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: {
                            color: tickColor,
                            font: { size: 10 },
                            maxTicksLimit: 12,
                            callback: function (val, index) {
                                return index % 4 === 0 ? labels[index] : '';
                            }
                        },
                        title: { display: true, text: '时间', color: tickColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, font: { size: 10 } },
                        title: { display: true, text: '转速 (rpm)', color: tickColor },
                        min: 0,
                        max: 9000,
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    })();

    // ============ 2. 飞轮电机温度变化曲线 ============
    (function () {
        const ctx = document.getElementById('tempChart');
        if (!ctx) return;

        const labels = [];
        const tempData = [];
        const startTemp = 38.3;

        // 0-147s (0-2min27s) 的温度变化
        for (let t = 0; t <= 150; t += 3) {
            const sec = t;
            const min = Math.floor(sec / 60);
            const s = sec % 60;
            labels.push(min + 'm' + s.toString().padStart(2, '0') + 's');

            let temp;
            if (t <= 40.46) {
                // 前40s: 温度较稳定，有略微下降趋势（热对流散热）
                temp = startTemp - (t / 40.46) * 0.5 + (Math.random() - 0.5) * 0.3;
            } else {
                // 40s后: 近似线性上升，~2.96°C/min
                const elapsedMin = (t - 40.46) / 60;
                temp = startTemp - 0.3 + elapsedMin * 2.96 + (Math.random() - 0.5) * 0.4;
            }
            tempData.push(parseFloat(temp.toFixed(1)));
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '电机温度 (°C)',
                    data: tempData,
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.08)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#ff6b35',
                }, {
                    label: '报警阈值 (60°C)',
                    data: Array(labels.length).fill(60),
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    borderWidth: 1.5,
                    borderDash: [8, 4],
                    fill: false,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#9ca3af',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.dataset.label + ': ' + ctx.parsed.y + '°C';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: {
                            color: tickColor,
                            font: { size: 10 },
                            maxTicksLimit: 10,
                            callback: function (val, index) {
                                return index % 7 === 0 ? labels[index] : '';
                            }
                        },
                        title: { display: true, text: '时间', color: tickColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, font: { size: 10 } },
                        title: { display: true, text: '温度 (°C)', color: tickColor },
                        min: 30,
                        max: 70,
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    })();

    // ============ 3. 输出模式储能量曲线 (空载) ============
    (function () {
        const ctx = document.getElementById('energyNoLoadChart');
        if (!ctx) return;

        const labels = [];
        const energyData = [];
        const rpmData = [];
        const initEnergy = 1100.3;
        const initRPM = 8365;
        const minRPM = 2000;

        // 0-22.81s 空载输出
        for (let t = 0; t <= 23; t += 0.5) {
            labels.push(t.toFixed(1) + 's');

            if (t <= 22.81) {
                const progress = t / 22.81;
                // 转速近似线性下降（空载主要是摩擦损耗）
                const rpm = initRPM - progress * (initRPM - minRPM);
                rpmData.push(Math.round(rpm));
                // 储能量与转速平方成正比 E ∝ ω² ∝ N²
                const energyRatio = Math.pow(rpm / initRPM, 2);
                const energy = initEnergy * energyRatio;
                energyData.push(parseFloat(energy.toFixed(1)));
            } else {
                rpmData.push(minRPM);
                energyData.push(66.1);
            }
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '储能量 (J)',
                    data: energyData,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.06)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#00ff88',
                    yAxisID: 'y',
                }, {
                    label: '飞轮转速 (rpm)',
                    data: rpmData,
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#9ca3af',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                if (ctx.datasetIndex === 0) {
                                    return '储能量: ' + ctx.parsed.y + ' J';
                                }
                                return '转速: ' + ctx.parsed.y + ' rpm';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 12 },
                        title: { display: true, text: '时间', color: tickColor }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: gridColor },
                        ticks: { color: '#00ff88', font: { size: 10 } },
                        title: { display: true, text: '储能量 (J)', color: '#00ff88' },
                        min: 0,
                        max: 1200,
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { display: false },
                        ticks: { color: '#00d4ff', font: { size: 10 } },
                        title: { display: true, text: '转速 (rpm)', color: '#00d4ff' },
                        min: 0,
                        max: 9000,
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    })();

    // ============ 4. 输出模式储能量曲线 (带载 3.3W) ============
    (function () {
        const ctx = document.getElementById('energyLoadChart');
        if (!ctx) return;

        const labels = [];
        const energyData = [];
        const rpmData = [];
        const initEnergy = 1126.2;
        const initRPM = 8287;
        const minRPM = 2000;

        // 0-20.72s 带载输出
        for (let t = 0; t <= 21; t += 0.5) {
            labels.push(t.toFixed(1) + 's');

            if (t <= 20.72) {
                const progress = t / 20.72;
                // 带载时转速下降稍快
                const rpm = initRPM - progress * (initRPM - minRPM);
                rpmData.push(Math.round(rpm));
                const energyRatio = Math.pow(rpm / initRPM, 2);
                const energy = initEnergy * energyRatio;
                energyData.push(parseFloat(energy.toFixed(1)));
            } else {
                rpmData.push(minRPM);
                energyData.push(66.7);
            }
        }

        // 标注点
        const durationIdx = Math.floor(20.72 / 0.5); // 约 index 41

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '储能量 (J)',
                    data: energyData,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.06)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#00ff88',
                    yAxisID: 'y',
                }, {
                    label: '飞轮转速 (rpm)',
                    data: rpmData,
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#9ca3af',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                if (ctx.datasetIndex === 0) {
                                    return '储能量: ' + ctx.parsed.y + ' J';
                                }
                                return '转速: ' + ctx.parsed.y + ' rpm';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 12 },
                        title: { display: true, text: '时间', color: tickColor }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: gridColor },
                        ticks: { color: '#00ff88', font: { size: 10 } },
                        title: { display: true, text: '储能量 (J)', color: '#00ff88' },
                        min: 0,
                        max: 1200,
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { display: false },
                        ticks: { color: '#3b82f6', font: { size: 10 } },
                        title: { display: true, text: '转速 (rpm)', color: '#3b82f6' },
                        min: 0,
                        max: 9000,
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    })();

    console.log('📊 图表初始化完成：4组测试数据曲线已加载');
});
