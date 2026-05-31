const BASE_URL = 'http://localhost:3001/api/auth';

async function testAuth() {
    try {
        // 1. Signup
        console.log('Testing Signup...');
        const signupRes = await fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: 'password123'
            })
        });

        const signupData = await signupRes.json();
        console.log('Signup Status:', signupRes.status);
        console.log('Signup Response:', signupData);

        if (!signupRes.ok) return;

        // 2. Login
        console.log('\nTesting Login...');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: signupData.email,
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        console.log('Login Status:', loginRes.status);
        console.log('Login Response:', loginData);

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testAuth();
