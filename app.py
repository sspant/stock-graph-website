"""
Stock Graph Website - Flask Application
Displays stock graphs for the most popular stocks using Finnhub and yfinance APIs
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify
from dotenv import load_dotenv
import requests
import yfinance as yf
import pandas as pd

load_dotenv()

app = Flask(__name__)
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')

# Cache to store stock data
stock_cache = {}
cache_timestamp = {}
CACHE_DURATION = 300  # 5 minutes in seconds


def get_popular_stocks():
    """
    Fetch the most popular stocks from Finnhub API (last 8 hours)
    """
    try:
        url = 'https://finnhub.io/api/v1/stock/news-sentiment'
        
        # Alternative endpoint for trends - using the market news endpoint
        url = 'https://finnhub.io/api/v1/news'
        params = {
            'category': 'general',
            'apikey': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        news_data = response.json()
        
        # Extract unique stocks from news
        stocks = {}
        for article in news_data.get('data', []):
            related = article.get('related', '')
            if related:
                for symbol in related.split(','):
                    symbol = symbol.strip().upper()
                    if symbol and len(symbol) <= 5:  # Valid stock symbols
                        stocks[symbol] = stocks.get(symbol, 0) + 1
        
        # Sort by frequency (popularity) and return top 10
        popular_stocks = sorted(stocks.items(), key=lambda x: x[1], reverse=True)[:10]
        return [stock[0] for stock in popular_stocks]
        
    except Exception as e:
        print(f"Error fetching popular stocks: {e}")
        # Return some default popular stocks if API fails
        return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ']


def get_stock_data(symbol):
    """
    Fetch stock data for the last 6 months (daily) and last 2 days (hourly)
    """
    try:
        # Check cache first
        if symbol in stock_cache:
            cache_time = cache_timestamp.get(symbol, 0)
            if (datetime.now() - cache_time).total_seconds() < CACHE_DURATION:
                return stock_cache[symbol]
        
        stock = yf.Ticker(symbol)
        
        # Get last 6 months daily data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)
        
        daily_data = yf.download(
            symbol,
            start=start_date,
            end=end_date,
            interval='1d',
            progress=False
        )
        
        # Get last 2 days hourly data
        two_days_ago = end_date - timedelta(days=2)
        hourly_data = yf.download(
            symbol,
            start=two_days_ago,
            end=end_date,
            interval='1h',
            progress=False
        )
        
        # Prepare data for chart
        daily_dates = daily_data.index.strftime('%Y-%m-%d').tolist()
        daily_prices = daily_data['Close'].round(2).tolist()
        
        hourly_dates = hourly_data.index.strftime('%Y-%m-%d %H:%M').tolist()
        hourly_prices = hourly_data['Close'].round(2).tolist()
        
        # Get stock info
        info = stock.info
        current_price = daily_data['Close'].iloc[-1] if len(daily_data) > 0 else 0
        previous_close = daily_data['Close'].iloc[-2] if len(daily_data) > 1 else current_price
        change = current_price - previous_close
        change_percent = (change / previous_close * 100) if previous_close != 0 else 0
        
        result = {
            'symbol': symbol,
            'current_price': round(current_price, 2),
            'change': round(change, 2),
            'change_percent': round(change_percent, 2),
            'daily': {
                'dates': daily_dates,
                'prices': daily_prices
            },
            'hourly': {
                'dates': hourly_dates,
                'prices': hourly_prices
            }
        }
        
        # Cache the result
        stock_cache[symbol] = result
        cache_timestamp[symbol] = datetime.now()
        
        return result
        
    except Exception as e:
        print(f"Error fetching stock data for {symbol}: {e}")
        return None


@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/api/popular-stocks')
def api_popular_stocks():
    """API endpoint to get popular stocks"""
    try:
        popular = get_popular_stocks()
        return jsonify({
            'success': True,
            'stocks': popular
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/stock-data/<symbol>')
def api_stock_data(symbol):
    """API endpoint to get stock data for a specific symbol"""
    try:
        symbol = symbol.upper()
        data = get_stock_data(symbol)
        
        if data is None:
            return jsonify({
                'success': False,
                'error': f'Could not fetch data for {symbol}'
            }), 404
        
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/all-stocks-data')
def api_all_stocks_data():
    """API endpoint to get all popular stocks with their data"""
    try:
        popular_stocks = get_popular_stocks()
        stocks_data = []
        
        for symbol in popular_stocks:
            data = get_stock_data(symbol)
            if data:
                stocks_data.append(data)
        
        return jsonify({
            'success': True,
            'data': stocks_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
