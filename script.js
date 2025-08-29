// script.js - БЕЗ API-КЛЮЧА!
const CURRENT_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

let currentRequests = [];
const weatherCache = new Map();
const CACHE_TIME = 5 * 60 * 1000;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Weather App initialized');
    
    // Проверяем, что API_KEY загрузился из config.js
    if (typeof API_KEY === 'undefined') {
        alert('Ошибка: API ключ не настроен. Проверьте файл config.js');
        return;
    }
    
    initWeatherApp();
});

function initWeatherApp() {
    initEventListeners();
    
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
        document.getElementById('city-input').value = lastCity;
        getWeatherData(lastCity);
    } else {
        getLocationByIP();
    }
}

function getLocationByIP() {
    showLoading(true);
    showSkeleton(true);
    
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            getWeatherData(data.city);
        })
        .catch(error => {
            console.log('Автоопределение не сработало, используем Москву');
            getWeatherData('Moscow');
        })
        .finally(() => {
            showLoading(false);
            showSkeleton(false);
        });
}

function initEventListeners() {
    const searchBtn = document.getElementById('search-btn');
    const cityInput = document.getElementById('city-input');
    
    if (searchBtn && cityInput) {
        searchBtn.addEventListener('click', handleSearch);
        cityInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
    }
}

function handleSearch() {
    const city = document.getElementById('city-input').value.trim();
    if (city) {
        localStorage.setItem('lastCity', city);
        getWeatherData(city);
    }
}

async function getWeatherData(city) {
    try {
        abortPreviousRequests();
        showLoading(true);
        showSkeleton(true);
        clearPreviousData();
        
        const cached = weatherCache.get(city.toLowerCase());
        if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
            displayWeatherData(cached);
            return;
        }
        
        const controller = new AbortController();
        currentRequests.push(controller);
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${CURRENT_WEATHER_URL}?q=${city}&appid=${API_KEY}&units=metric&lang=ru`, {
                signal: controller.signal
            }),
            fetch(`${FORECAST_URL}?q=${city}&appid=${API_KEY}&units=metric&lang=ru`, {
                signal: controller.signal
            })
        ]);
        
        clearTimeout(timeoutId);
        
        if (!currentResponse.ok) throw new Error('Город не найден');
        if (!forecastResponse.ok) throw new Error('Ошибка прогноза');
        
        const [currentData, forecastData] = await Promise.all([
            currentResponse.json(),
            forecastResponse.json()
        ]);
        
        const weatherData = { current: currentData, forecast: forecastData };
        weatherCache.set(city.toLowerCase(), {
            ...weatherData,
            timestamp: Date.now()
        });
        
        displayWeatherData(weatherData);
        
    } catch (error) {
        handleError(error);
    } finally {
        showLoading(false);
        showSkeleton(false);
        currentRequests = [];
    }
}

function displayWeatherData(data) {
    displayCurrentWeather(data.current);
    displayForecast(data.forecast);
}

function displayCurrentWeather(data) {
    if (!data || !data.name) return;
    
    document.getElementById('city-name').textContent = data.name;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('weather-desc').textContent = data.weather[0].description;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = `${data.wind.speed} м/с`;
    document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}°C`;
    
    // Восход и закат
    if (data.sys) {
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        document.getElementById('sunrise').textContent = formatTime(sunrise);
        document.getElementById('sunset').textContent = formatTime(sunset);
    }
    
    // Иконка погоды
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    document.getElementById('weather-icon').alt = data.weather[0].description;
    
    // Обновляем фон
    updateBackground(data.weather[0].id);
}

function displayForecast(data) {
    const forecastContainer = document.getElementById('forecast-cards');
    if (!forecastContainer || !data.list) return;
    
    forecastContainer.innerHTML = '';
    const dailyForecasts = [];
    
    for (let i = 0; i < data.list.length; i += 8) {
        dailyForecasts.push(data.list[i]);
    }
    
    dailyForecasts.forEach(day => {
        const date = new Date(day.dt * 1000);
        const dayCard = document.createElement('div');
        dayCard.className = 'forecast-day';
        
        dayCard.innerHTML = `
            <div class="forecast-date">${formatForecastDate(date)}</div>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png" 
                 alt="${day.weather[0].description}" class="forecast-icon">
            <div class="forecast-temp">${Math.round(day.main.temp)}°C</div>
            <div class="forecast-desc">${day.weather[0].description}</div>
            <div class="forecast-details">
                <span>💧 ${day.main.humidity}%</span>
                <span>💨 ${day.wind.speed} м/с</span>
            </div>
        `;
        
        forecastContainer.appendChild(dayCard);
    });
}

function updateBackground(weatherCode) {
    const weatherClasses = [
        'clear-sky', 'few-clouds', 'clouds', 'rain', 
        'thunderstorm', 'snow', 'mist'
    ];
    document.body.classList.remove(...weatherClasses);
    
    let weatherClass = 'clear-sky';
    if (weatherCode >= 200 && weatherCode < 300) weatherClass = 'thunderstorm';
    else if (weatherCode >= 300 && weatherCode < 600) weatherClass = 'rain';
    else if (weatherCode >= 600 && weatherCode < 700) weatherClass = 'snow';
    else if (weatherCode >= 700 && weatherCode < 800) weatherClass = 'mist';
    else if (weatherCode === 800) weatherClass = 'clear-sky';
    else if (weatherCode > 800) weatherClass = 'clouds';
    
    document.body.classList.add(weatherClass);
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatForecastDate(date) {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function abortPreviousRequests() {
    currentRequests.forEach(controller => controller.abort());
    currentRequests = [];
}

function clearPreviousData() {
    const forecastContainer = document.getElementById('forecast-cards');
    if (forecastContainer) forecastContainer.innerHTML = '';
}

function showLoading(loading) {
    const btn = document.getElementById('search-btn');
    if (btn) {
        btn.textContent = loading ? 'Загрузка...' : 'Поиск';
        btn.disabled = loading;
    }
}

function showSkeleton(show) {
    const skeleton = document.getElementById('skeleton');
    const currentWeather = document.getElementById('current-weather');
    if (skeleton && currentWeather) {
        skeleton.classList.toggle('active', show);
        currentWeather.style.display = show ? 'none' : 'block';
    }
}

function handleError(error) {
    console.error('Error:', error);
    const errorMsg = error.name === 'AbortError' ? 
        'Запрос превысил время ожидания' : 
        'Ошибка: ' + error.message;
    alert(errorMsg);
}