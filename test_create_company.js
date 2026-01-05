const http = require('http');

// Generate a random company name
const companyName = 'TestCorp_' + Math.floor(Math.random() * 10000);

const data = JSON.stringify({
    name: companyName
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/create-company',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log(`🧪 Testing: Creating new company "${companyName}"...`);

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Create Status: ${res.statusCode}`);
        console.log('Response:', responseBody);

        if (res.statusCode === 200) {
            console.log('✅ SUCCESS: Company created!');
            console.log('📝 Check your Google Sheet to verify:');
            console.log('   - New tab exists');
            console.log('   - Headers are BOLD');
            console.log('   - Top row is FROZEN');
        } else {
            console.log('❌ FAILED: ' + responseBody);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Connection Error:', error);
    console.log('💡 TIP: Is the server running? Run start_app.bat first!');
});

req.write(data);
req.end();
