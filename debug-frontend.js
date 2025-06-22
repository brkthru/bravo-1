// Quick debug script to check the frontend
const http = require('http');

// Check if frontend is serving files
http.get('http://localhost:5174/src/main.tsx', (res) => {
  console.log('main.tsx status:', res.statusCode);
  console.log('main.tsx headers:', res.headers['content-type']);
});

// Check if Vite is transforming imports correctly
http.get('http://localhost:5174/@fs' + process.cwd() + '/shared/src/index.ts', (res) => {
  console.log('shared module status:', res.statusCode);
});

// Test the API proxy
http.get('http://localhost:5174/api/campaigns', (res) => {
  console.log('API proxy status:', res.statusCode);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('API proxy works:', json.success, 'campaigns:', json.data?.length);
    } catch (e) {
      console.log('API proxy error:', e.message);
    }
  });
});