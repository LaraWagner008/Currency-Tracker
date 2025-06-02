// Объект для хранения текущих курсов
let currentRates = {
  USD: null,
  EUR: null,
  BTC: null,
  ETH: null
};

// Элементы DOM
const rateCards = {
  USD: document.getElementById('usd'),
  EUR: document.getElementById('eur'),
  BTC: document.getElementById('btc'),
  ETH: document.getElementById('eth')
};

const rateValues = {
  USD: document.querySelector('#usd .rate-value'),
  EUR: document.querySelector('#eur .rate-value'),
  BTC: document.querySelector('#btc .rate-value'),
  ETH: document.querySelector('#eth .rate-value')
};

const rateChanges = {
  USD: document.querySelector('#usd .rate-change'),
  EUR: document.querySelector('#eur .rate-change'),
  BTC: document.querySelector('#btc .rate-change'),
  ETH: document.querySelector('#eth .rate-change')
};

const timeButtons = document.querySelectorAll('.time-btn');
const currencySelect = document.getElementById('currency-select');
const chartCanvas = document.getElementById('currency-chart');
const amountInput = document.getElementById('amount');
const fromCurrencySelect = document.getElementById('from-currency');
const toCurrencySelect = document.getElementById('to-currency');
const convertedAmountInput = document.getElementById('converted-amount');
const swapButton = document.getElementById('swap-currencies');

// Инициализация графика
let currencyChart = new Chart(chartCanvas, {
  type: 'line',
  data: {
      labels: [],
      datasets: [{
          label: 'Курс',
          data: [],
          borderColor: '#77F2FF',
          backgroundColor: 'rgba(119, 242, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0
      }]
  },
  options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: {
              display: false
          },
          tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                  label: function(context) {
                      return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ₽`;
                  }
              }
          }
      },
      scales: {
          x: {
              grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                  color: '#F2D785'
              }
          },
          y: {
              grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                  color: '#F2D785',
                  callback: function(value) {
                      return value + ' ₽';
                  }
              }
          }
      },
      interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
      }
  }
});

// Функция для форматирования чисел
function formatNumber(num, decimals = 2) {
  return num.toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
  });
}

// Функция для обновления карточек с курсами
function updateRateCards() {
  for (const currency in currentRates) {
      if (currentRates[currency]) {
          const rate = currentRates[currency].rate;
          const change = currentRates[currency].change;
          
          rateValues[currency].textContent = formatNumber(rate, currency === 'BTC' || currency === 'ETH' ? 2 : 2) + ' ₽';
          
          if (change > 0) {
              rateChanges[currency].textContent = `▲ ${change.toFixed(2)}%`;
              rateChanges[currency].className = 'rate-change';
          } else if (change < 0) {
              rateChanges[currency].textContent = `▼ ${Math.abs(change).toFixed(2)}%`;
              rateChanges[currency].className = 'rate-change negative';
          } else {
              rateChanges[currency].textContent = '→ 0.00%';
              rateChanges[currency].className = 'rate-change';
          }
          
          rateCards[currency].classList.remove('loading');
      }
  }
}

// Функция для загрузки текущих курсов
async function fetchCurrentRates() {
  // Добавляем класс loading к карточкам
  for (const currency in rateCards) {
      rateCards[currency].classList.add('loading');
  }

  try {
      // 1. Загрузка курсов фиатных валют (USD, EUR) с API ЦБ РФ
      const cbrResponse = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js');
      
      if (cbrResponse.data && cbrResponse.data.Valute) {
          currentRates.USD = {
              rate: cbrResponse.data.Valute.USD.Value,
              change: parseFloat(cbrResponse.data.Valute.USD.Previous - cbrResponse.data.Valute.USD.Value) / cbrResponse.data.Valute.USD.Previous * 100
          };
          
          currentRates.EUR = {
              rate: cbrResponse.data.Valute.EUR.Value,
              change: parseFloat(cbrResponse.data.Valute.EUR.Previous - cbrResponse.data.Valute.EUR.Value) / cbrResponse.data.Valute.EUR.Previous * 100
          };
      }

      // 2. Загрузка курсов криптовалют (BTC, ETH) с CoinGecko API
      const cryptoResponse = await axios.get(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=rub&include_24hr_change=true'
      );

      if (cryptoResponse.data) {
          currentRates.BTC = {
              rate: cryptoResponse.data.bitcoin.rub,
              change: cryptoResponse.data.bitcoin.rub_24h_change
          };
          
          currentRates.ETH = {
              rate: cryptoResponse.data.ethereum.rub,
              change: cryptoResponse.data.ethereum.rub_24h_change
          };
      }

      updateRateCards();
      updateConverter();
  } catch (error) {
      console.error('Ошибка при загрузке курсов:', error);
      
      /*
      // Fallback: используем mock данные при ошибке API
      const mockRates = {
          USD: { rate: 90.45, change: 0.12 },
          EUR: { rate: 98.75, change: -0.34 },
          BTC: { rate: 3500000, change: 1.56 },
          ETH: { rate: 200000, change: -0.89 }
      };

      for (const currency in mockRates) {
          currentRates[currency] = mockRates[currency];
      }
*/
      updateRateCards();
      updateConverter();
  }
}



// Функция для загрузки исторических данных
async function fetchHistoricalData(currency, days) {
  try {
      let data = [];
      
      if (currency === 'USD' || currency === 'EUR') {
          // Для фиатных валют используем CoinGecko как fallback (у ЦБ РФ нет удобного исторического API)
          const vsCurrency = 'rub';
          const response = await axios.get(
              `https://api.coingecko.com/api/v3/coins/${currency.toLowerCase()}/market_chart?vs_currency=${vsCurrency}&days=${days}`
          );
          
          data = response.data.prices.map(item => ({
              time: item[0] / 1000,
              value: item[1]
          }));
      } else {
          // Для криптовалют используем CoinGecko API
          const coinId = currency === 'BTC' ? 'bitcoin' : 'ethereum';
          const response = await axios.get(
              `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=rub&days=${days}`
          );
          
          data = response.data.prices.map(item => ({
              time: item[0] / 1000,
              value: item[1]
          }));
      }
      
      return data;
  } catch (error) {
      console.error(`Ошибка загрузки исторических данных для ${currency}:`, error);
      return [];
  }
}

async function updateChart() {
    const currency = currencySelect.value;
    const interval = document.querySelector('.time-btn.active').dataset.interval;
    
    const intervalSettings = {
      '1d': {
        days: 1,
        points: 24,
        timeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        currentFormat: { hour: '2-digit', minute: '2-digit', hour12: false }
      },
      '1w': {
        days: 7,
        points: 7,
        timeFormat: { weekday: 'short', day: 'numeric', month: 'short' },
        currentFormat: { weekday: 'short', day: 'numeric', month: 'short' }
      },
      '1m': {
        days: 30,
        points: 30,
        timeFormat: { day: 'numeric', month: 'short' },
        currentFormat: { day: 'numeric', month: 'short' }
      },
      '1y': {
        days: 365,
        points: 12,
        timeFormat: { month: 'short', year: 'numeric' },
        currentFormat: { month: 'short', year: 'numeric' }
      }
    };
    
    const settings = intervalSettings[interval];
    const historicalData = await fetchHistoricalData(currency, settings.days);
  
    if (historicalData.length === 0) return;
  
    const step = Math.max(1, Math.floor(historicalData.length / settings.points));
    const sampledData = [];
    const labels = [];
    
    for (let i = 0; i < historicalData.length; i += step) {
      const item = historicalData[i];
      const date = new Date(item.time * 1000);
      
      sampledData.push(item.value);
      
      if (interval === '1d') {
        labels.push(date.toLocaleTimeString('ru-RU', settings.timeFormat));
      } else {
        labels.push(date.toLocaleDateString('ru-RU', settings.timeFormat));
      }
      
      if (labels.length >= settings.points) break;
    }
  
    // Добавляем текущую дату/время для всех интервалов
    if (sampledData.length > 0) {
      const now = new Date();
      let currentLabel;
      
      if (interval === '1d') {
        currentLabel = now.toLocaleTimeString('ru-RU', settings.currentFormat);
      } else {
        currentLabel = now.toLocaleDateString('ru-RU', settings.currentFormat);
      }
      
      // Проверяем, нет ли уже такой метки (чтобы не дублировать)
      if (!labels.includes(currentLabel)) {
        labels.push(currentLabel);
        sampledData.push(sampledData[sampledData.length - 1]); // Используем последнее значение
      }
    }
  
    currencyChart.data.labels = labels;
    currencyChart.data.datasets[0].data = sampledData;
    currencyChart.data.datasets[0].label = `${currency}/RUB`;
    currencyChart.data.datasets[0].borderColor = getCurrencyColor(currency);
    currencyChart.data.datasets[0].backgroundColor = `${getCurrencyColor(currency)}20`;
    
    currencyChart.update();
}

// Получение цвета для валюты
function getCurrencyColor(currency) {
  switch(currency) {
      case 'USD': return '#D0F252';
      case 'EUR': return '#C10FF2';
      case 'BTC': return '#F2D785';
      case 'ETH': return '#77F2FF';
      default: return '#FFFFFF';
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
let isConverting = false;

function convertCurrency(e) {
    if (isConverting) return;
    isConverting = true;

    const fromAmount = parseFloat(amountInput.value.replace(',', '.'));
    const toAmount = parseFloat(convertedAmountInput.value.replace(',', '.'));
    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;

    // RUB всегда 1
    function getRate(cur) {
        if (cur === 'RUB') return 1;
        return currentRates[cur]?.rate || null;
    }

    // Определяем, из какого поля был ввод
    let activeField = null;
    if (e && e.target === amountInput) activeField = 'from';
    else if (e && e.target === convertedAmountInput) activeField = 'to';
    else activeField = 'from'; // по умолчанию

    if (activeField === 'from') {
        if (isNaN(fromAmount) || fromAmount < 0) {
            convertedAmountInput.value = '';
            isConverting = false;
            return;
        }
        if (fromCurrency === toCurrency) {
            convertedAmountInput.value = fromAmount;
        } else {
            const fromRate = getRate(fromCurrency);
            const toRate = getRate(toCurrency);
            if (!fromRate || !toRate) {
                convertedAmountInput.value = '';
            } else {
                const rubAmount = fromAmount * fromRate;
                const result = rubAmount / toRate;
                const digits = (toCurrency === 'BTC' || toCurrency === 'ETH') ? 8 : 2;
                convertedAmountInput.value = result.toFixed(digits);
            }
        }
    } else if (activeField === 'to') {
        if (isNaN(toAmount) || toAmount < 0) {
            amountInput.value = '';
            isConverting = false;
            return;
        }
        if (fromCurrency === toCurrency) {
            amountInput.value = toAmount;
        } else {
            const fromRate = getRate(fromCurrency);
            const toRate = getRate(toCurrency);
            if (!fromRate || !toRate) {
                amountInput.value = '';
            } else {
                const rubAmount = toAmount * toRate;
                const result = rubAmount / fromRate;
                const digits = (fromCurrency === 'BTC' || fromCurrency === 'ETH') ? 8 : 2;
                amountInput.value = result.toFixed(digits);
            }
        }
    }

    isConverting = false;
}

function updateConverter() {
    convertCurrency();
}

// Обработчики событий
amountInput.addEventListener('input', convertCurrency);
convertedAmountInput.addEventListener('input', function(e) { convertCurrency(e); });
fromCurrencySelect.addEventListener('change', function() { convertCurrency({target: amountInput}); });
toCurrencySelect.addEventListener('change', function() { convertCurrency({target: amountInput}); });

swapButton.addEventListener('click', () => {
    const temp = fromCurrencySelect.value;
    fromCurrencySelect.value = toCurrencySelect.value;
    toCurrencySelect.value = temp;
    convertCurrency({target: amountInput});
});

// Обработчики для кнопок временных интервалов и выбора валюты
document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelector('.time-btn.active').classList.remove('active');
        this.classList.add('active');
        updateChart();
    });
});

document.getElementById('currency-select').addEventListener('change', function() {
    updateChart();
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  fetchCurrentRates();
  updateChart();
  
  // Обновляем данные каждую 1 минуту
  setInterval(fetchCurrentRates, 1 * 60 * 1000);
});


// Анимация при наведении на карточки валют
for (const currency in rateCards) {
  rateCards[currency].addEventListener('mouseenter', () => {
      rateCards[currency].style.transform = 'translateY(-5px)';
      rateCards[currency].style.boxShadow = '0 10px 20px rgba(119, 242, 255, 0.3)';
  });
  
  rateCards[currency].addEventListener('mouseleave', () => {
      rateCards[currency].style.transform = '';
      rateCards[currency].style.boxShadow = '';
  });
}