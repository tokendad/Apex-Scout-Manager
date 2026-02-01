# Cookie Booth Sheet - Import Implementation Specification

## Overview
This document defines the data structure and import format for Girl Scout Cookie booth sales tracking sheets to be imported into GSCTracker.

## Data Schema

### Booth Session Metadata
```json
{
  "boothSession": {
    "location": "string",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "cashStatus": {
      "over": "number (dollars)",
      "under": "number (dollars)",
      "perfect": "boolean"
    }
  }
}
```

### Volunteer Information
```json
{
  "volunteers": [
    {
      "name": "string",
      "timeIn": "HH:MM",
      "timeOut": "HH:MM",
      "totalHours": "number (decimal)"
    }
  ]
}
```

### Inventory Tracking
```json
{
  "inventory": {
    "lemonUps": {
      "start": "number (boxes)",
      "end": "number (boxes)",
      "sold": "number (boxes)"
    },
    "trefoils": { "start": 0, "end": 0, "sold": 0 },
    "doSiDos": { "start": 0, "end": 0, "sold": 0 },
    "samoas": { "start": 0, "end": 0, "sold": 0 },
    "tagalongs": { "start": 0, "end": 0, "sold": 0 },
    "thinMints": { "start": 0, "end": 0, "sold": 0 },
    "smores": { "start": 0, "end": 0, "sold": 0 },
    "toffeeTastic": { "start": 0, "end": 0, "sold": 0 },
    "adventurefuls": { "start": 0, "end": 0, "sold": 0 }
  }
}
```

### Sales & Payment Tracking
```json
{
  "payments": {
    "cash": {
      "start": "number (dollars)",
      "end": "number (dollars)"
    },
    "creditCard": {
      "card1": "number (dollars)",
      "card2": "number (dollars)"
    },
    "donations": {
      "cash": "number (dollars)",
      "credit": "number (dollars)"
    },
    "venmo": {
      "app1": "number (dollars)",
      "app2": "number (dollars)"
    }
  }
}
```

### Reconciliation
```json
{
  "reconciliation": {
    "totalBoxes": "number",
    "totalSales": "number (dollars)",
    "totalCollected": "number (dollars)",
    "netSales": "number (dollars)",
    "startingCash": 300.00,
    "pricePerBox": 6.00
  }
}
```

## Complete Import Format

### JSON Format (Recommended)
```json
{
  "boothSession": {
    "location": "Walmart - Main St",
    "date": "2025-01-23",
    "startTime": "10:00",
    "endTime": "14:00",
    "cashStatus": {
      "over": 0,
      "under": 0,
      "perfect": true
    }
  },
  "volunteers": [
    {
      "name": "Jane Smith",
      "timeIn": "10:00",
      "timeOut": "12:00",
      "totalHours": 2.0
    },
    {
      "name": "John Doe",
      "timeIn": "12:00",
      "timeOut": "14:00",
      "totalHours": 2.0
    }
  ],
  "inventory": {
    "lemonUps": { "start": 24, "end": 12, "sold": 12 },
    "trefoils": { "start": 36, "end": 20, "sold": 16 },
    "doSiDos": { "start": 48, "end": 25, "sold": 23 },
    "samoas": { "start": 60, "end": 15, "sold": 45 },
    "tagalongs": { "start": 72, "end": 30, "sold": 42 },
    "thinMints": { "start": 120, "end": 40, "sold": 80 },
    "smores": { "start": 24, "end": 18, "sold": 6 },
    "toffeeTastic": { "start": 24, "end": 20, "sold": 4 },
    "adventurefuls": { "start": 36, "end": 25, "sold": 11 }
  },
  "payments": {
    "cash": {
      "start": 300.00,
      "end": 485.00
    },
    "creditCard": {
      "card1": 720.00,
      "card2": 180.00
    },
    "donations": {
      "cash": 15.00,
      "credit": 25.00
    },
    "venmo": {
      "app1": 240.00,
      "app2": 0.00
    }
  },
  "reconciliation": {
    "totalBoxes": 239,
    "totalSales": 1434.00,
    "totalCollected": 1665.00,
    "netSales": 1365.00,
    "startingCash": 300.00,
    "pricePerBox": 6.00
  }
}
```

### CSV Format (Alternative)

#### booth_sessions.csv
```csv
location,date,startTime,endTime,over,under,perfect
"Walmart - Main St",2025-01-23,10:00,14:00,0,0,true
```

#### booth_volunteers.csv
```csv
sessionId,name,timeIn,timeOut,totalHours
1,"Jane Smith",10:00,12:00,2.0
1,"John Doe",12:00,14:00,2.0
```

#### booth_inventory.csv
```csv
sessionId,cookieType,start,end,sold
1,lemonUps,24,12,12
1,trefoils,36,20,16
1,doSiDos,48,25,23
1,samoas,60,15,45
1,tagalongs,72,30,42
1,thinMints,120,40,80
1,smores,24,18,6
1,toffeeTastic,24,20,4
1,adventurefuls,36,25,11
```

#### booth_payments.csv
```csv
sessionId,paymentType,subType,amount
1,cash,start,300.00
1,cash,end,485.00
1,creditCard,card1,720.00
1,creditCard,card2,180.00
1,donations,cash,15.00
1,donations,credit,25.00
1,venmo,app1,240.00
1,venmo,app2,0.00
```

## Validation Rules

### Required Fields
- `boothSession.location` - must not be empty
- `boothSession.date` - must be valid date
- At least one volunteer entry
- All inventory items must have start/end values

### Calculated Fields
- `sold` = `start` - `end` for each cookie type
- `totalBoxes` = sum of all `sold` values
- `totalSales` = `totalBoxes` × `pricePerBox`
- `totalCollected` = `payments.cash.end` + sum of all credit/venmo/donations
- `netSales` = `totalCollected` - `payments.cash.start`

### Business Rules
- `payments.cash.start` defaults to $300.00
- `pricePerBox` defaults to $6.00
- `sold` cannot be negative
- `totalHours` should be calculated from `timeIn` and `timeOut`

## Import API Endpoint Specification

### POST /api/booth-sessions/import

#### Request Body (JSON)
```json
{
  "format": "json|csv",
  "data": { ... } // or array of CSV rows
}
```

#### Response (Success)
```json
{
  "success": true,
  "sessionId": "uuid",
  "summary": {
    "totalBoxesSold": 239,
    "totalRevenue": 1434.00,
    "volunteersCount": 2,
    "duration": "4 hours"
  }
}
```

#### Response (Error)
```json
{
  "success": false,
  "errors": [
    {
      "field": "inventory.thinMints.sold",
      "message": "Calculated sold value (80) doesn't match start-end difference"
    }
  ]
}
```

## Usage with Claude Code

### Generate Import File
```bash
# Interactive mode
claude-code "Create a booth session import file for today's sale at Kroger from 2-6pm"

# From scanned/manual data
claude-code "Convert this booth sheet data to JSON import format:
Location: Target
Date: 1/23/2025
Thin Mints: started 144, ended 23
..."
```

### Validate Before Import
```bash
claude-code "Validate this booth import file and check calculations"
```

### Batch Import
```bash
claude-code "Import all booth sheets from the booth_data folder"
```

## Database Schema Recommendations

### Tables

#### booth_sessions
```sql
CREATE TABLE booth_sessions (
  id UUID PRIMARY KEY,
  location VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  cash_over DECIMAL(10,2),
  cash_under DECIMAL(10,2),
  is_perfect BOOLEAN,
  starting_cash DECIMAL(10,2) DEFAULT 300.00,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### booth_volunteers
```sql
CREATE TABLE booth_volunteers (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES booth_sessions(id),
  name VARCHAR(255) NOT NULL,
  time_in TIME,
  time_out TIME,
  total_hours DECIMAL(4,2)
);
```

#### booth_inventory
```sql
CREATE TABLE booth_inventory (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES booth_sessions(id),
  cookie_type VARCHAR(50) NOT NULL,
  start_quantity INTEGER NOT NULL,
  end_quantity INTEGER NOT NULL,
  sold_quantity INTEGER GENERATED ALWAYS AS (start_quantity - end_quantity) STORED
);
```

#### booth_payments
```sql
CREATE TABLE booth_payments (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES booth_sessions(id),
  payment_type VARCHAR(50) NOT NULL, -- cash, credit, venmo, donation
  sub_type VARCHAR(50), -- card1, card2, app1, app2, etc
  amount DECIMAL(10,2) NOT NULL
);
```

## Cookie Types Reference

| Internal Name | Display Name | Typical Price |
|--------------|--------------|---------------|
| lemonUps | Lemon-Ups™ | $6.00 |
| trefoils | Trefoils® | $6.00 |
| doSiDos | Do-si-dos® | $6.00 |
| samoas | Caramel deLites®/Samoas® | $6.00 |
| tagalongs | Peanut Butter Patties®/Tagalongs® | $6.00 |
| thinMints | Thin Mints® | $6.00 |
| smores | Girl Scout S'mores® | $6.00 |
| toffeeTastic | Toffee-tastic® | $6.00 |
| adventurefuls | Adventurefuls™ | $6.00 |

## Error Handling

### Common Issues
1. **Math errors**: Sold ≠ Start - End
   - Auto-correct or flag for review
   
2. **Missing end inventory**: End values not recorded
   - Calculate from cash reconciliation
   
3. **Cash discrepancy**: Total collected ≠ Expected from boxes
   - Flag as "over" or "under"
   
4. **Duplicate sessions**: Same location/date/time
   - Warn before import

## Integration Notes

### GSCTracker Compatibility
- Use existing user/scout association
- Link to digital cookie orders if applicable
- Update overall inventory levels
- Generate financial reports
- Track volunteer hours for recognition

### Export Formats
- PDF receipt generation
- Excel summary reports
- Council reporting format
- Email summaries to troop leaders

## Version History
- v1.0 - Initial specification (2025-01-23)
