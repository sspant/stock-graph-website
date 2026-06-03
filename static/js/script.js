// Stock Graph Dashboard - Client-side JavaScript

const COLORS = {
    primary: '#667eea',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b'
};

const charts = {}; // Store chart instances

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    loadStocks();

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function () {
        this.classList.add('loading');
        loadStocks().finally(() => {
            this.classList.remove('loading');
        });
    });
});

/**
 * Load all popular stocks and their data
 */
async function loadStocks() {
    const container = document.getElementById('stocksContainer');
    const loading = document.getElementById('loading');
    const errorContainer = document.getElementById('errorContainer');

    try {
        errorContainer.style.display = 'none';
        loading.style.display = 'flex';
        container.innerHTML = '';

        // Fetch all stocks data
        const response = await fetch('/api/all-stocks-data');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to load stocks');
        }

        if (result.data.length === 0) {
            container.innerHTML = '<div class="no-data"><div class="no-data-icon">📊</div><p>No stock data available</p></div>';
            return;
        }

        // Display stocks sorted by popularity
        result.data.forEach((stock, index) => {
            createStockCard(stock, index);
        });

        loading.style.display = 'none';
    } catch (error) {
        console.error('Error loading stocks:', error);
        errorContainer.innerHTML = `<strong>Error:</strong> ${error.message}`;
        errorContainer.style.display = 'block';
        loading.style.display = 'none';
    }
}

/**
 * Create a stock card with chart
 */
function createStockCard(stock, index) {
    const container = document.getElementById('stocksContainer');

    const card = document.createElement('div');
    card.className = 'stock-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const change = stock.change;
    const changePercent = stock.change_percent;
    const isPositive = change >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    const changeIcon = isPositive ? '📈' : '📉';

    card.innerHTML = `
        <div class="stock-header">
            <div>
                <div class="stock-symbol">${stock.symbol}</div>
                <div class="stock-price">$${stock.current_price.toFixed(2)}</div>
            </div>
            <div class="stock-change ${changeClass}">
                ${changeIcon} ${isPositive ? '+' : ''}${changePercent.toFixed(2)}%
            </div>
        </div>

        <div class="chart-tabs">
            <button class="chart-tab active" data-chart-type="daily" data-symbol="${stock.symbol}">
                6 Months
            </button>
            <button class="chart-tab" data-chart-type="hourly" data-symbol="${stock.symbol}">
                Last 2 Days (Hourly)
            </button>
        </div>

        <div class="chart-container">
            <canvas id="chart-${stock.symbol}-daily"></canvas>
        </div>

        <div id="chart-container-hourly-${stock.symbol}" class="chart-container" style="display: none;">
            <canvas id="chart-${stock.symbol}-hourly"></canvas>
        </div>

        <div class="chart-legend">
            <div class="chart-legend-item">
                <div class="legend-color" style="background: ${COLORS.primary};"></div>
                <span>${stock.symbol} Price</span>
            </div>
            <div class="chart-legend-item">
                <span>Updated: ${new Date().toLocaleString()}</span>
            </div>
        </div>
    `;

    container.appendChild(card);

    // Create charts
    createDailyChart(stock);
    createHourlyChart(stock);

    // Add tab switching listeners
    card.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const symbol = this.dataset.symbol;
            const type = this.dataset.chartType;

            // Update active tab
            card.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Show/hide charts
            const dailyContainer = card.querySelector(`.chart-container`);
            const hourlyContainer = card.querySelector(`#chart-container-hourly-${symbol}`);

            if (type === 'daily') {
                dailyContainer.style.display = 'block';
                hourlyContainer.style.display = 'none';
            } else {
                dailyContainer.style.display = 'none';
                hourlyContainer.style.display = 'block';
            }
        });
    });
}

/**
 * Create daily chart (6 months)
 */
function createDailyChart(stock) {
    const canvasId = `chart-${stock.symbol}-daily`;
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Calculate min and max for better scaling
    const prices = stock.daily.prices;
    const minPrice = Math.min(...prices) * 0.99;
    const maxPrice = Math.max(...prices) * 1.01;

    const chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stock.daily.dates,
            datasets: [{
                label: `${stock.symbol} - Daily Close Price`,
                data: prices,
                borderColor: COLORS.primary,
                backgroundColor: createGradient(ctx, COLORS.primary),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: COLORS.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 12 },
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: minPrice,
                    max: maxPrice,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function (value, index) {
                            // Display fewer labels on x-axis
                            if (index % Math.floor(this.getLabelForValue(value).length / 8) === 0) {
                                return this.getLabelForValue(value);
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });

    charts[`${stock.symbol}-daily`] = chartInstance;
}

/**
 * Create hourly chart (last 2 days)
 */
function createHourlyChart(stock) {
    const canvasId = `chart-${stock.symbol}-hourly`;
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const prices = stock.hourly.prices;
    if (prices.length === 0) return;

    const minPrice = Math.min(...prices) * 0.99;
    const maxPrice = Math.max(...prices) * 1.01;

    const chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stock.hourly.dates,
            datasets: [{
                label: `${stock.symbol} - Hourly Average Price`,
                data: prices,
                borderColor: COLORS.warning,
                backgroundColor: createGradient(ctx, COLORS.warning),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 8,
                pointBackgroundColor: COLORS.warning,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 12 },
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: minPrice,
                    max: maxPrice,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        callback: function (value, index) {
                            // Display fewer labels on x-axis
                            if (index % Math.floor(this.getLabelForValue(value).length / 12) === 0 || index === 0 || index === this.getLabels().length - 1) {
                                const label = this.getLabelForValue(value);
                                return label.split(' ')[1]; // Show only time
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });

    charts[`${stock.symbol}-hourly`] = chartInstance;
}

/**
 * Create a gradient for the chart background
 */
function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '00');
    return gradient;
}

/**
 * Format large numbers with K, M, B suffixes
 */
function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}
