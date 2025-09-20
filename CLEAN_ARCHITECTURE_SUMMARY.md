# Clean Architecture Implementation Summary

## Overview
The codebase has been refactored from a monolithic single-file structure to a clean architecture pattern with clear separation of concerns.

## Architecture Structure

### 📁 Directory Structure
```
src/
├── config/                 # Configuration management
│   └── Config.ts          # Centralized configuration service
├── domain/                # Business logic and domain models
│   └── models/
│       └── QueryResponse.ts
├── infrastructure/        # External services and API clients
│   └── api/
│       └── SalesforceApiClient.ts
├── application/           # Application services and use cases
│   ├── Application.ts    # Main application orchestrator
│   └── services/
│       └── QueryService.ts
├── utils/                # Utility classes and helpers
│   └── CsvWriter.ts
├── types/                # TypeScript type definitions
│   └── MetaDataField.ts
└── index.ts             # Application entry point
```

## Key Improvements

### 1. **Separation of Concerns**
- **Config Layer**: Centralized configuration management with validation
- **Domain Layer**: Pure business logic and data models
- **Infrastructure Layer**: API client implementation with Salesforce-specific endpoints
- **Application Layer**: Service orchestration and use case implementation
- **Utils Layer**: Reusable utilities like CSV writing

### 2. **OAuth Authentication Implementation**
- **New Auth Service**: `SalesforceAuthService` for OAuth client credentials flow
- **Dynamic Token Management**: Automatic token refresh with 2-hour expiry
- **Fallback Support**: Can use either OAuth or static access token
- **Client Credentials**: Uses client_id and client_secret from curl

### 3. **Updated API Endpoints**
- **Old**: `/services/data/v64.0/ssot/queryv2`
- **New**: `/services/data/v64.0/ssot/query-sql`

### 4. **Updated Configuration**
- **Instance URL**: `https://ptblendmediakreasi2.my.salesforce.com`
- **OAuth Client ID**:
- **OAuth Client Secret**: 
- **SQL Query**: `SELECT cdp_sys_SourceVersion__c, created_at__c, DataSource__c, DataSourceObject__c, customerId__c, emailAddress__c, EventDate__c, eventTime__c, id__c FROM transactions_erasandbox_25__dll LIMIT 100`

### 5. **Design Patterns Applied**
- **Singleton Pattern**: ConfigService for centralized configuration
- **Dependency Injection**: Services receive dependencies through constructors
- **Interface Segregation**: Clean interfaces for API clients and services
- **Single Responsibility**: Each class has one clear responsibility
- **Strategy Pattern**: OAuth vs static token authentication strategies

### 5. **Error Handling**
- Centralized error handling in API client
- Proper error messages with context
- Graceful failure handling

### 6. **Testability**
- Services are easily testable with mock implementations
- Clear interfaces for dependency injection
- Isolated components for unit testing

## Usage

The application can now be run with:
```bash
npm start
```

Or for development:
```bash
npm run dev
```

## Environment Variables
All configuration is managed through environment variables in `.env`:

### Required Variables
- `SF_INSTANCE_URL`: Salesforce instance URL
- `SF_DATASPACE`: Dataspace name
- `QUERY_SQL`: SQL query to execute

### Optional Variables
- `SF_API_VERSION`: API version (default: v64.0)
- `OUTPUT_CSV`: Output CSV file path (auto-generated if not specified)

### Authentication Variables
Choose one authentication method:

**Option 1: OAuth (Recommended)**
- `USE_OAUTH=true`: Enable OAuth authentication
- `SF_CLIENT_ID`: OAuth client ID
- `SF_CLIENT_SECRET`: OAuth client secret

**Option 2: Static Token**
- `SF_ACCESS_TOKEN`: Static access token
- `USE_OAUTH=false` or omit `USE_OAUTH`

### Example Configuration
```bash
# Instance Configuration
SF_INSTANCE_URL=https://ptblendmediakreasi2.my.salesforce.com
SF_API_VERSION=v64.0
SF_DATASPACE=default

# OAuth Configuration (Recommended)
USE_OAUTH=true
SF_CLIENT_ID=
SF_CLIENT_SECRET=

# Query Configuration
QUERY_SQL=SELECT cdp_sys_SourceVersion__c, created_at__c, DataSource__c, DataSourceObject__c, customerId__c, emailAddress__c, EventDate__c, eventTime__c, id__c FROM transactions_erasandbox_25__dll LIMIT 100
OUTPUT_CSV=./out.csv
```
