
const config = {
    corsOrigin: ['http://localhost:3001']
};

function isOriginAllowed(origin) {
    // Logic from app.ts (FIXED Version)

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return true;

    // Check if origin is allowed
    const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin];

    // Check for exact match in allowed origins (e.g. localhost)
    if (allowedOrigins.indexOf(origin) !== -1) {
        return true;
    }

    // Check for .tixmo.co subdomains (Regex)
    // Allows: https://demo.tixmo.co, https://anything.tixmo.co (if valid chars)
    // Vulnerability Fix: Use stricter regex and remove railway check
    const tixmoPattern = /^https:\/\/(?:[a-zA-Z0-9-]+\.)+tixmo\.co$/;
    if (tixmoPattern.test(origin)) {
        return true;
    }

    // REMOVED: Also allow railway apps for dynamic preview branches if needed
    // if (origin.endsWith('.up.railway.app')) {
    //   return true;
    // }

    return false;
}

function runTest(origin, expectedResult, description) {
    const result = isOriginAllowed(origin);
    if (result === expectedResult) {
        console.log(`PASS: ${description} (Origin: ${origin}) -> Got: ${result}`);
    } else {
        console.error(`FAIL: ${description} (Origin: ${origin}) -> Expected: ${expectedResult}, Got: ${result}`);
        // process.exit(1);
    }
}

console.log('--- Verify CORS Logic (Fixed Version) ---');

// Test Cases
runTest('http://localhost:3001', true, 'Explicitly allowed origin');
runTest('https://demo.tixmo.co', true, 'Valid TixMo subdomain');
runTest('https://sub.demo.tixmo.co', true, 'Nested TixMo subdomain');

// Vulnerability Check: Should be FALSE now
runTest('https://evil.up.railway.app', false, 'Arbitrary Railway App (SHOULD BE DENIED)');

runTest('https://evil.com', false, 'External domain');
runTest('https://evil-tixmo.co', false, 'Invalid TixMo lookalike');

// Additional Regex Checks
runTest('https://evil.com.tixmo.co', true, 'Subdomain containing tixmo.co suffix (Still allowed as valid subdomain)');
runTest('https://anything.tixmo.co', true, 'Anything valid subdomain');
runTest('https://bad*char.tixmo.co', false, 'Invalid chars in subdomain');

console.log('--- End of Test ---');
