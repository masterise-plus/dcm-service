import { SalesforceAuthService } from '@/infrastructure/auth/SalesforceAuthService';
import { SalesforceApiClient } from '@/infrastructure/api/SalesforceApiClient';
import { ConfigService } from '@/config/Config';

/**
 * Demonstration of the enhanced token validation and caching features
 */
async function demonstrateTokenValidation() {
  console.log('🚀 Starting Token Validation and Caching Demo\n');

  const config = ConfigService.getInstance().getConfig();
  
  // Demo 1: OAuth-based authentication with validation
  console.log('📋 Demo 1: OAuth Authentication with Token Validation');
  console.log('====================================================');
  
  if (config.useOAuth && config.clientId && config.clientSecret) {
    const authService = new SalesforceAuthService(
      config.clientId,
      config.clientSecret
    );

    try {
      console.log('1. Getting access token (may trigger validation if cached)...');
      const token = await authService.getAccessToken();
      console.log(`   ✅ Token obtained: ${token.substring(0, 20)}...`);
      
      console.log('2. Checking if cached token is valid...');
      const isValid = await authService.isTokenValid();
      console.log(`   ✅ Token is valid: ${isValid}`);
      
      console.log('3. Getting cached token...');
      const cachedToken = authService.getCachedToken();
      console.log(`   ✅ Cached token: ${cachedToken ? cachedToken.substring(0, 20) + '...' : 'None'}`);
      
      console.log('4. Validating a specific token...');
      const validationResult = await authService.validateToken(token);
      console.log(`   ✅ Token validation result: ${validationResult}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('   ⚠️  OAuth credentials not configured, skipping OAuth demo');
  }

  // Demo 2: API Client with static token validation
  console.log('\n📋 Demo 2: API Client with Static Token Validation');
  console.log('==================================================');
  
  const apiClient = new SalesforceApiClient();
  
  try {
    console.log('1. Getting access token through API client...');
    const token = await apiClient.getAccessToken();
    console.log(`   ✅ Token obtained: ${token.substring(0, 20)}...`);
    
    console.log('2. Token is automatically validated before use');
    console.log('   ✅ Static token validation passed');
    
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Demo 3: Token caching behavior
  console.log('\n📋 Demo 3: Token Caching Behavior');
  console.log('==================================');
  
  if (config.useOAuth && config.clientId && config.clientSecret) {
    const authService = new SalesforceAuthService(
      config.clientId,
      config.clientSecret
    );

    try {
      console.log('1. First call - may require token refresh...');
      const startTime = Date.now();
      const token1 = await authService.getAccessToken();
      const firstCallTime = Date.now() - startTime;
      console.log(`   ⏱️  First call took: ${firstCallTime}ms`);
      
      console.log('2. Second call - should use cached/validated token...');
      const startTime2 = Date.now();
      const token2 = await authService.getAccessToken();
      const secondCallTime = Date.now() - startTime2;
      console.log(`   ⏱️  Second call took: ${secondCallTime}ms`);
      console.log(`   🚀 Performance improvement: ${((firstCallTime - secondCallTime) / firstCallTime * 100).toFixed(1)}% faster`);
      
      console.log('3. Both tokens should be identical...');
      console.log(`   ✅ Tokens match: ${token1 === token2}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n✅ Token Validation and Caching Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Token validation before use');
  console.log('• Automatic token refresh when invalid/expired');
  console.log('• Validation result caching (5-minute TTL)');
  console.log('• Performance optimization through caching');
  console.log('• Comprehensive error handling');
  console.log('• Support for both OAuth and static tokens');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateTokenValidation()
    .then(() => {
      console.log('\n🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateTokenValidation };
