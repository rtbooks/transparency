# API Reference - Temporal Endpoints

This document describes the temporal versioning API endpoints that enable historical data queries and audit trail access.

## Overview

All mutable financial entities (Organization, Account, OrganizationUser, PlannedPurchase) support temporal versioning. This means:
- Every change creates a new version (never destructive updates)
- Complete audit trail with who/when/what changed
- Query data as of any past date
- View full version history

## Authentication

All endpoints require authentication via Clerk. Include the session token in requests:
```
Authorization: Bearer <session_token>
```

## Organization History

### Get Organization Version History

Retrieve all versions of an organization.

```http
GET /api/organizations/{slug}/history
```

**Response:**
```json
{
  "organizationId": "org_123",
  "totalVersions": 5,
  "history": [
    {
      "versionId": "ver_5",
      "previousVersionId": "ver_4",
      "name": "Updated Name",
      "validFrom": "2024-06-15T10:30:00Z",
      "validTo": "9999-12-31T23:59:59Z",
      "systemFrom": "2024-06-15T10:30:00Z",
      "systemTo": "9999-12-31T23:59:59Z",
      "changedBy": "user_456",
      "isDeleted": false,
      "changes": ["name"]
    },
    // ... older versions
  ]
}
```

**Query Parameters:**
- `limit` (optional, default: 50) - Number of versions to return
- `offset` (optional, default: 0) - Pagination offset

### Get Organization As Of Date

Retrieve organization state as it was on a specific date.

```http
GET /api/organizations/{slug}/as-of/{date}
```

**Parameters:**
- `date` - ISO 8601 date (e.g., `2024-06-15` or `2024-06-15T10:30:00Z`)

**Response:**
```json
{
  "organization": {
    "id": "org_123",
    "versionId": "ver_3",
    "name": "Organization Name at that time",
    "validFrom": "2024-01-01T00:00:00Z",
    "validTo": "2024-07-01T00:00:00Z",
    // ... other fields as they were
  }
}
```

**Error Response (404):**
```json
{
  "error": "Organization not found at that date"
}
```

### Get Organization Changes in Date Range

Retrieve all changes to an organization within a date range.

```http
GET /api/organizations/{slug}/changes?from={startDate}&to={endDate}
```

**Query Parameters:**
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)

**Response:**
```json
{
  "changes": [
    {
      "versionId": "ver_4",
      "changedAt": "2024-06-15T10:30:00Z",
      "changedBy": "user_456",
      "changes": {
        "name": {
          "old": "Old Name",
          "new": "New Name"
        },
        "website": {
          "old": "https://old.com",
          "new": "https://new.com"
        }
      }
    }
  ]
}
```

## Account History

### Get Account Version History

Retrieve all versions of a specific account.

```http
GET /api/organizations/{slug}/accounts/{accountId}/history
```

**Response:**
```json
{
  "accountId": "acc_123",
  "totalVersions": 8,
  "history": [
    {
      "versionId": "ver_8",
      "previousVersionId": "ver_7",
      "name": "Account Name",
      "balance": 1500.00,
      "validFrom": "2024-06-15T14:20:00Z",
      "validTo": "9999-12-31T23:59:59Z",
      "changedBy": "user_789",
      "changes": ["balance"]
    },
    // ... older versions
  ]
}
```

## Financial Reports (Temporal-Aware)

All financial reports support temporal queries.

### Balance Sheet As Of Date

```http
GET /api/organizations/{slug}/reports/balance-sheet?asOfDate={date}
```

**Query Parameters:**
- `asOfDate` (optional, default: today) - Date for balance sheet

**Response:**
```json
{
  "organization": {
    "id": "org_123",
    "name": "Organization Name"
  },
  "asOfDate": "2024-06-15T00:00:00Z",
  "assets": {
    "current": [
      {
        "accountId": "acc_1",
        "code": "1000",
        "name": "Cash",
        "balance": 10000.00
      }
    ],
    "fixed": [
      {
        "accountId": "acc_2",
        "code": "1500",
        "name": "Equipment",
        "balance": 25000.00
      }
    ],
    "totalCurrent": 15000.00,
    "totalFixed": 25000.00,
    "total": 40000.00
  },
  "liabilities": {
    "current": [],
    "longTerm": [],
    "totalCurrent": 0,
    "totalLongTerm": 0,
    "total": 0
  },
  "equity": {
    "accounts": [
      {
        "accountId": "acc_3",
        "code": "3000",
        "name": "Retained Earnings",
        "balance": 40000.00
      }
    ],
    "total": 40000.00
  },
  "balanceCheck": {
    "assetsTotal": 40000.00,
    "liabilitiesAndEquityTotal": 40000.00,
    "balanced": true
  }
}
```

### Income Statement for Period

```http
GET /api/organizations/{slug}/reports/income-statement?startDate={start}&endDate={end}
```

**Query Parameters:**
- `startDate` - Period start date (ISO 8601)
- `endDate` - Period end date (ISO 8601)

**Response:**
```json
{
  "organization": { "id": "org_123", "name": "Org Name" },
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "revenue": {
    "accounts": [
      {
        "accountId": "acc_4",
        "code": "4000",
        "name": "Donations",
        "activity": 50000.00
      }
    ],
    "total": 50000.00
  },
  "expenses": {
    "accounts": [
      {
        "accountId": "acc_5",
        "code": "5000",
        "name": "Salaries",
        "activity": 30000.00
      }
    ],
    "total": 30000.00
  },
  "netIncome": 20000.00
}
```

### Cash Flow for Period

```http
GET /api/organizations/{slug}/reports/cash-flow?startDate={start}&endDate={end}
```

**Query Parameters:**
- `startDate` - Period start date (ISO 8601)
- `endDate` - Period end date (ISO 8601)

**Response:**
```json
{
  "organization": { "id": "org_123", "name": "Org Name" },
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "cashAccounts": ["acc_1", "acc_2"],
  "beginningBalance": 5000.00,
  "operating": {
    "inflows": 50000.00,
    "outflows": 30000.00,
    "net": 20000.00
  },
  "investing": {
    "inflows": 0,
    "outflows": 10000.00,
    "net": -10000.00
  },
  "financing": {
    "inflows": 5000.00,
    "outflows": 0,
    "net": 5000.00
  },
  "netChange": 15000.00,
  "endingBalance": 20000.00
}
```

## Analytics Endpoints

### Membership Changes

```http
GET /api/organizations/{slug}/reports/analytics/membership?startDate={start}&endDate={end}
```

**Query Parameters:**
- `startDate` - Analysis start date
- `endDate` - Analysis end date

**Response:**
```json
{
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "summary": {
    "additions": 5,
    "removals": 2,
    "roleChanges": 3,
    "totalChanges": 10
  },
  "timeline": [
    {
      "date": "2024-02-15",
      "changeType": "addition",
      "userId": "user_123",
      "userName": "John Doe",
      "role": "DONOR"
    },
    {
      "date": "2024-03-20",
      "changeType": "roleChange",
      "userId": "user_456",
      "userName": "Jane Smith",
      "oldRole": "DONOR",
      "newRole": "ORG_ADMIN"
    }
  ]
}
```

## Common Query Patterns

### Get Current State

To get the current (latest) version, use standard endpoints without temporal parameters:

```http
GET /api/organizations/{slug}
GET /api/organizations/{slug}/accounts
```

### Time Travel Query

To see how things looked on a specific date:

```http
# Organization state on June 15, 2024
GET /api/organizations/grit-hoops/as-of/2024-06-15

# Balance sheet as of year-end 2023
GET /api/organizations/grit-hoops/reports/balance-sheet?asOfDate=2023-12-31
```

### Audit Trail

To see what changed:

```http
# All changes in Q2 2024
GET /api/organizations/grit-hoops/changes?from=2024-04-01&to=2024-06-30

# Full version history
GET /api/organizations/grit-hoops/history
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid date format",
  "details": "Date must be ISO 8601 format"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "details": "Valid session token required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "details": "You don't have permission to access this organization"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "details": "Organization not found or not valid at specified date"
}
```

## Rate Limits

- 100 requests per minute per authenticated user
- 1000 requests per hour per organization

## Caching

Temporal queries are cached based on:
- Organization ID
- Query date/range
- Current user permissions

Cache TTL: 5 minutes for current data, 1 hour for historical data

## Best Practices

1. **Use specific dates**: Always provide timezone information in ISO 8601 format
2. **Cache aggressively**: Historical data doesn't change - cache on client side
3. **Pagination**: Use limit/offset for large history queries
4. **Date ranges**: Keep date ranges reasonable (≤1 year) for performance
5. **As-of queries**: Use end-of-day timestamps for clearer semantics

## Example: Building an Audit Trail UI

```javascript
// Fetch changes for the last 30 days
const endDate = new Date();
const startDate = new Date();
startDate.setDate(endDate.getDate() - 30);

const response = await fetch(
  `/api/organizations/grit-hoops/changes?` +
  `from=${startDate.toISOString()}&` +
  `to=${endDate.toISOString()}`,
  {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  }
);

const { changes } = await response.json();

// Display in timeline UI
changes.forEach(change => {
  console.log(`${change.changedAt}: ${change.changedBy} modified`, 
    Object.keys(change.changes).join(', '));
});
```

## See Also

- [TEMPORAL_SCHEMA_DESIGN.md](./TEMPORAL_SCHEMA_DESIGN.md) - Database schema patterns
- [TEMPORAL_IMPLEMENTATION_STATUS.md](./TEMPORAL_IMPLEMENTATION_STATUS.md) - Implementation details
- [APPROACH.md](./APPROACH.md) - Overall architecture
