# Sales Order Value Help Implementation Summary

## Overview

Implemented authorization-aware Value Help routing that determines the value help source based on the logged-in user's group indicator:

- **HP Buyer users** (`groupIndicator = "HP"`) → Value Helps from **MDM**
- **Customer users** (`groupIndicator = "C"`) → Value Helps from **local SalesOrders data**

## Changes Made

### 1. User Scope Enhancement (`srv/utils/userScope.js`)

Added `groupIndicator` field to the user scope object returned by `loadUserScope()`:

- **HP users**: `groupIndicator = "HP"` (from MDM user property `userGroupIndicator`)
- **Customer users**: `groupIndicator = "C"`
- **Technical/privileged users**: `groupIndicator = "HP"`
- **Failed/unknown users**: `groupIndicator = null`

The groupIndicator is now available in all scope return paths:
- Technical user path
- HP user path (buyer indicator)
- Customer user path
- Fail closed path

### 2. Value Help Routing Logic (`srv/utils/valueHelpScope.js`)

#### Enhanced Source Determination
- Implemented `getValueHelpSource(scope)` function that:
  - Returns `"MDM"` for HP users
  - Returns `"LOCAL"` for Customer users
  - Returns `"EMPTY"` for unknown/unsupported users

#### Refactored Value Help Reading
Updated `readValueHelp()` function to:
1. Check authorization (visibility/N/A access)
2. Determine source based on user group
3. Route to appropriate source:
   - **MDM path**: Only for HP users; configured MDM VHs
   - **LOCAL path**: Only for Customer users; configured local VHs
   - **EMPTY**: Unknown source or access denied

#### Added Local Value Help Configurations
Extended `VALUE_HELP_CONFIG` with local (SalesOrders-based) versions of MDM value helps:

**From SalesOrders:**
- `VH_Buyer` → `hpBuyerCode`, `hpBuyerName`
- `VH_BuyerName` → `hpBuyerCode`, `hpBuyerName`
- `VH_CompanyCode` → `hpCompanyCode`, `hpCompanyDescription`
- `VH_WbsProject` → `wbsProjectCode`, `wbsProjectCodeDescription`
- `VH_BusinessModel` → `businessModel`

**From SalesOrderItems:**
- `VH_HpPartNumber` → `hpPartNumber`, `hpPartDescription`

Plus existing local configurations for:
- Customer, Sales Order, Line Item, Status codes, Origin codes, etc.

### 3. MDM Value Help Enhancement (`srv/utils/mdmValueHelps.js`)

Enhanced `readMdmValueHelp()` function to accept optional `additionalWhere` parameter for future filtering needs.

## Architecture

```
Logged-in User Request
    ↓
loadUserScope()
    ↓
Extract groupIndicator
    ↓
+----------------+--------------------+
|                                      |
v                                      v
groupIndicator = "HP"          groupIndicator = "C"
    ↓                              ↓
MDM Value Helps         Local SalesOrders Value Helps
    ↓                              ↓
Customer + WBS Authorization
    ↓
Filtered Results
```

## Authorization Enforcement

### HP Users
- Receive Value Helps from MDM
- No row-level filtering on MDM results
- All configured MDM value helps available

### Customer Users
- Receive Value Helps from local SalesOrders data
- Row-level authorization applied using existing Customer + WBS scope
- Only values existing in their authorized SalesOrders are returned
- N/A access fields return empty results
- Value helps not configured as LOCAL return empty

### Unsupported Users
- Unknown `groupIndicator` returns empty value helps
- No fallback between sources
- Fails closed on authorization issues

## Data Flow Example

User: `customer.jabil@example.com`
- `groupIndicator = "C"`
- `customerId = 0260003194`
- `projectIds = [W-2000475]`

### VH_Customer Request
1. Check authorization → allowed
2. Determine source → "LOCAL"
3. Query SalesOrders with:
   - `customerCode = '0260003194'`
   - `wbsProjectCode IN ('W-2000475')`
4. Return distinct `customerCode` values (only from authorized rows)

### VH_Buyer Request
1. Check authorization → allowed
2. Determine source → "LOCAL"
3. Query SalesOrders with same authorization filters
4. Return distinct `hpBuyerCode, hpBuyerName` (only from authorized rows)

## Features

✓ **No Source Fallback**: Customer users never fall back to MDM
✓ **Authorization Enforcement**: Existing Customer + WBS scope applied to all local VH queries
✓ **N/A Handling**: Hidden/N/A fields return empty results
✓ **OData Support**: Maintains `$count`, `$top`, `$skip`, `$filter`, `$search` with authorization
✓ **Clear Logging**: Logs indicate which source (MDM/LOCAL) is used
✓ **No Credentials Logged**: Only source and user group logged, never sensitive data

## Configuration

All Value Help configurations are in `VALUE_HELP_CONFIG`:
- `source: "local"` - Uses local SalesOrders query
- `entity` - CDS entity name
- `columns` - Columns to select (DISTINCT)
- `scope: true` - Apply Customer + WBS authorization filter

## Testing Checklist

- [ ] HP user sees MDM value helps for all configured VHs
- [ ] HP user sees full MDM dataset (e.g., BuyerVH: 13+ rows)
- [ ] Customer user sees only local SalesOrders value helps
- [ ] Customer user value helps restricted to authorized rows
- [ ] Hidden/N/A fields return empty for Customer users
- [ ] OData filters respect authorization boundaries
- [ ] Search/filter operations work correctly
- [ ] $count reflects authorized results only
- [ ] Pagination ($top, $skip) works with authorization
- [ ] Logs clearly show source (MDM/LOCAL) for each VH request

## Future Enhancements

1. **Enrichment**: Optionally use MDM descriptions for already-authorized LOCAL values
2. **Plant/Location VHs**: Add LOCAL configurations for plant-based value helps
3. **Dynamic Visibility**: Consider making value help visibility user-configurable
4. **Audit Logging**: Add detailed audit logs for value help access
