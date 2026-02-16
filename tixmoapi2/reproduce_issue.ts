
const API_URL = 'http://localhost:3000/api/v1';

async function main() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@tixmo.com', password: 'Password123!' })
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loginData = await loginRes.json() as any;
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        const token = loginData.data.accessToken;
        console.log('Logged in. Token length:', token.length);

        // 2. Get Events
        console.log('Fetching events...');
        const eventsRes = await fetch(`${API_URL}/events`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventsData = await eventsRes.json() as any;
        if (!eventsRes.ok) throw new Error(`Fetch events failed: ${JSON.stringify(eventsData)}`);

        // Check structure
        console.log('Events response keys:', Object.keys(eventsData));
        if (eventsData.data) console.log('Events data keys:', Object.keys(eventsData.data));

        const events = eventsData.data.events || eventsData.data.data || [];
        console.log(`Found ${events.length} events.`);

        if (events.length === 0) throw new Error('No events found to test with.');
        const eventId = events[0].id;
        console.log(`Using event ID: ${eventId}`);

        // 3. Create Approval
        console.log(`Creating approval for event ${eventId}...`);
        // Payload matching ApprovalStudio.jsx
        const payload = {
            title: 'Test Approval Script',
            eventId: '00000000-0000-0000-0000-000000000000', // Non-existent UUID
            type: 'MEDIA', // or SOCIAL
            priority: 'STANDARD',
            dueDate: new Date().toISOString(),
            description: 'Test description',
            instructions: 'Test instructions',
            // content: undefined, // JSON.stringify removes undefined keys
            organizationId: 'should-be-ignored-or-cause-error' // Frontend sends this
        };

        console.log('Sending payload:', JSON.stringify(payload, null, 2));

        const createRes = await fetch(`${API_URL}/approvals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createData = await createRes.json() as any;
        if (!createRes.ok) {
            console.error('Create approval failed status:', createRes.status);
            console.error('Error Body:', JSON.stringify(createData, null, 2));
        } else {
            console.log('Approval created successfully:', createData);
        }

    } catch (error) {
        console.error('Script Error:', error);
    }
}

main();
