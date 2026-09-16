import * as fs from 'fs';

async function run() {
  const envFile = fs.readFileSync('.env.local', 'utf-8');
  const apiKeyLine = envFile.split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
  const apiKey = apiKeyLine ? apiKeyLine.split('=')[1].trim() : '';
  
  console.log('Fetching models with key length:', apiKey?.length);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
    } else {
      console.log("No models returned. API Response:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('Error fetching models:', e);
  }
}
run();
