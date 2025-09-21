// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import { SalesforceAuthService } from '@/infrastructure/auth/SalesforceAuthService';

async function testCachingBehavior() {
  console.log('🚀 Testing Token Caching Behavior\n');

  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('❌ OAuth credentials not configured');
    return;
  }

  const authService = new SalesforceAuthService(clientId, clientSecret);

  try {
    console.log('⏱️  Performance Test: First call (may require token refresh)...');
    const start1 = Date.now();
    const token1 = await authService.getAccessToken();
    const time1 = Date.now() - start1;
    console.log(`   ✅ First call completed in: ${time1}ms`);
    console.log(`   ✅ Token: ${token1.substring(0, 30)}...`);

    console.log('\n⏱️  Performance Test: Second call (should use cached/validated token)...');
    const start2 = Date.now();
    const token2 = await authService.getAccessToken();
    const time2 = Date.now() - start2;
    console.log(`   ✅ Second call completed in: ${time2}ms`);
    console.log(`   ✅ Token: ${token2.substring(0, 30)}...`);

    console.log('\n📊 Performance Analysis:');
    const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
    console.log(`   🚀 Performance improvement: ${improvement}% faster`);
    console.log(`   💾 Using cached token: ${token1 === token2}`);
    
    if (time2 < time1) {
      console.log('   ✅ Caching is working - second call was faster!');
    } else {
      console.log('   ⚠️  Both calls took similar time (validation may have been required)');
    }

    console.log('\n🔍 Validation Test:');
    const isValid = await authService.isTokenValid();
    console.log(`   ✅ Current token is valid: ${isValid}`);

    const cachedToken = authService.getCachedToken();
    console.log(`   ✅ Cached token available: ${cachedToken !== null}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test
testCachingBehavior()
  .then(() => {
    console.log('\n🎉 Caching test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Caching test error:', error);
    process.exit(1);
  });
