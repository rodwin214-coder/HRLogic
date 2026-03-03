import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hdxflopzzfxfnldlnfsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkeGZsb3B6emZ4Zm5sZGxuZnNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjQ4MzcsImV4cCI6MjA4NTI0MDgzN30.lpbTXSkTwtM-IX8pWfFP-5qbX-wo9d8FyGhd304TA1g';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);

// Test 1: Check if we can query the companies table
console.log('\n=== Test 1: Query companies table ===');
try {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error querying companies:', error.message);
        console.error('Error details:', error);
    } else {
        console.log('Success! Found', data?.length || 0, 'companies');
        if (data && data.length > 0) {
            console.log('Sample company:', data[0]);
        }
    }
} catch (err) {
    console.error('Exception:', err.message);
}

// Test 2: Check if we can query the employees table
console.log('\n=== Test 2: Query employees table ===');
try {
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error querying employees:', error.message);
        console.error('Error details:', error);
    } else {
        console.log('Success! Found', data?.length || 0, 'employees');
        if (data && data.length > 0) {
            console.log('Sample employee:', data[0]);
        }
    }
} catch (err) {
    console.error('Exception:', err.message);
}

// Test 3: Check user_accounts table
console.log('\n=== Test 3: Query user_accounts table ===');
try {
    const { data, error } = await supabase
        .from('user_accounts')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error querying user_accounts:', error.message);
    } else {
        console.log('Success! Found', data?.length || 0, 'user accounts');
    }
} catch (err) {
    console.error('Exception:', err.message);
}

// Test 4: Simple health check
console.log('\n=== Test 4: Database health check ===');
try {
    const { data, error } = await supabase.rpc('version');
    if (error) {
        console.log('RPC test failed (expected):', error.message);
    } else {
        console.log('Database version:', data);
    }
} catch (err) {
    console.log('RPC test error (expected)');
}

console.log('\n=== Tests complete ===');
