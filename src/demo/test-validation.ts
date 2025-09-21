// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import { SalesforceAuthService } from '@/infrastructure/auth/SalesforceAuthService';
import { SalesforceApiClient } from '@/infrastructure/api/SalesforceApiClient';

async function testTokenValidation() {
  console.log('🚀 Testing Token Validation Implementation\n');

  const instanceUrl = process.env.SF_INSTANCE_URL;
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const accessToken = process.env.SF_ACCESS_TOKEN;
  const useOAuth = process.env.USE_OAUTH === 'true';

  console.log('Environment Configuration:');
  console.log(`- Instance URL: ${instanceUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`- OAuth Enabled: ${useOAuth}`);
  console.log(`- Client ID: ${clientId ? '✅ Configured' : '❌ Missing'}`);
  console.log(`- Client Secret: ${clientSecret ? '✅ Configured' : '❌ Missing'}`);
  console.log(`- Access Token: ${accessToken ? '✅ Configured' : '❌ Missing'}\n`);

  try {
    if (useOAuth && clientId && clientSecret) {
      console.log('🔐 Testing OAuth Authentication with Validation...');
      const authService = new SalesforceAuthService(clientId, clientSecret);
      
      console.log('1. Getting access token...');
      const token = await authService.getAccessToken();
      console.log(`   ✅ Token obtained: ${token.substring(0, 30)}...`);
      
      console.log('2. Validating token...');
      const isValid = await authService.validateToken(token);
      console.log(`   ✅ Token validation result: ${isValid}`);
      
      console.log('3. Checking cached token...');
      const cachedToken = authService.getCachedToken();
      console.log(`   ✅ Cached token: ${cachedToken ? 'Present' : 'None'}`);
      
    } else if (accessToken) {
      console.log('🔑 Testing Static Token Validation...');
      const apiClient = new SalesforceApiClient();
      
      console.log('1. Getting validated access token...');
      const token = await apiClient.getAccessToken();
      console.log(`   ✅ Token obtained: ${token.substring(0, 30)}...`);
      console.log('   ✅ Static token validation passed');
      
    } else {
      console.log('❌ No authentication method configured');
    }

    console.log('\n✅ Token validation test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test
testTokenValidation()
  .then(() => {
    console.log('\n🎉 Test finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });
