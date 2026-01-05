/**
 * Скрипт для проверки использования токенов из логов
 * Запуск: node scripts/check_token_usage.js
 */

const fs = require('fs');
const path = require('path');

// Путь к логам
const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'medical_assistant.log');

// Цены моделей (USD за 1M токенов)
const MODEL_PRICING = {
  'anthropic/claude-opus-4.5': { input: 15.0, output: 75.0 },
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'google/gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'google/gemini-3-flash': { input: 0.50, output: 3.00 },
  'google/gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'google/gemini-3-pro': { input: 1.25, output: 5.00 },
};

function calculateCost(inputTokens, outputTokens, model) {
  const pricing = MODEL_PRICING[model] || { input: 1.0, output: 5.0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    totalCostUnits: (inputCost + outputCost) * 100
  };
}

function parseLogFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Файл логов не найден: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const stats = {
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    totalCostUnits: 0,
    byModel: {},
    requests: []
  };

  // Поиск записей о токенах
  lines.forEach((line, index) => {
    // Паттерны для поиска информации о токенах
    const tokenMatch = line.match(/токен[а-я]*[:\s]+(\d+)/i) || 
                      line.match(/token[s]*[:\s]+(\d+)/i) ||
                      line.match(/total_tokens[:\s]+(\d+)/i);
    
    const modelMatch = line.match(/\[([^\]]+)\]/) ||
                      line.match(/model[:\s]+([^\s,]+)/i);
    
    const costMatch = line.match(/стоимость[:\s]+([\d.]+)/i) ||
                     line.match(/cost[:\s]+([\d.]+)/i);

    if (tokenMatch || modelMatch || costMatch) {
      const tokens = tokenMatch ? parseInt(tokenMatch[1]) : null;
      const model = modelMatch ? modelMatch[1] : 'unknown';
      
      if (tokens) {
        // Примерное разделение входных/выходных токенов (50/50)
        const inputTokens = Math.floor(tokens / 2);
        const outputTokens = Math.floor(tokens / 2);
        
        const cost = calculateCost(inputTokens, outputTokens, model);
        
        stats.totalTokens += tokens;
        stats.totalInputTokens += inputTokens;
        stats.totalOutputTokens += outputTokens;
        stats.totalCostUSD += cost.totalCost;
        stats.totalCostUnits += cost.totalCostUnits;
        
        if (!stats.byModel[model]) {
          stats.byModel[model] = {
            tokens: 0,
            cost: 0,
            requests: 0
          };
        }
        
        stats.byModel[model].tokens += tokens;
        stats.byModel[model].cost += cost.totalCost;
        stats.byModel[model].requests += 1;
        
        stats.requests.push({
          line: index + 1,
          model,
          tokens,
          cost: cost.totalCost,
          timestamp: line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] || 'unknown'
        });
      }
    }
  });

  return stats;
}

// Основная функция
function main() {
  console.log('📊 Анализ использования токенов из логов\n');
  console.log('='.repeat(60));
  
  const stats = parseLogFile(logFile);
  
  if (!stats || stats.requests.length === 0) {
    console.log('\n⚠️  Не найдено информации о токенах в логах.');
    console.log('\n💡 Для просмотра статистики:');
    console.log('   1. Откройте приложение в браузере');
    console.log('   2. Перейдите на страницу /statistics');
    console.log('   3. Статистика хранится в localStorage браузера');
    console.log('\n📝 Примечание: Статистика в localStorage доступна только в браузере.');
    return;
  }

  console.log(`\n📈 Общая статистика:`);
  console.log(`   Всего токенов: ${stats.totalTokens.toLocaleString('ru-RU')}`);
  console.log(`   Входных: ${stats.totalInputTokens.toLocaleString('ru-RU')}`);
  console.log(`   Выходных: ${stats.totalOutputTokens.toLocaleString('ru-RU')}`);
  console.log(`   💰 Общая стоимость: $${stats.totalCostUSD.toFixed(4)} USD`);
  console.log(`   💰 В условных единицах: ${stats.totalCostUnits.toFixed(2)} у.е.`);
  console.log(`   📊 Запросов: ${stats.requests.length}`);

  if (Object.keys(stats.byModel).length > 0) {
    console.log(`\n📊 По моделям:`);
    Object.entries(stats.byModel)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .forEach(([model, data]) => {
        console.log(`\n   ${model}:`);
        console.log(`      Токенов: ${data.tokens.toLocaleString('ru-RU')}`);
        console.log(`      Запросов: ${data.requests}`);
        console.log(`      Стоимость: $${data.cost.toFixed(4)} USD`);
      });
  }

  console.log(`\n📝 Последние ${Math.min(10, stats.requests.length)} запросов:`);
  stats.requests.slice(-10).reverse().forEach((req, idx) => {
    console.log(`   ${idx + 1}. ${req.model} - ${req.tokens.toLocaleString('ru-RU')} токенов - $${req.cost.toFixed(6)} USD`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Для более детальной статистики откройте страницу /statistics в браузере');
}

main();





