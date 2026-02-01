# Claude Code Usage Guide for Booth Sheet Import

## Quick Start

### Basic Import Flow
```bash
# 1. Create a JSON file from manual data
claude-code "Create a booth import file from this data:
Location: Target on Main Street
Date: January 23, 2025
Time: 2:00 PM to 6:00 PM
Volunteers: Sarah (2-4pm), Mike (4-6pm)
Thin Mints: Started with 144 boxes, ended with 23
Samoas: Started with 96, ended with 12
Tagalongs: Started with 72, ended with 28
Do-si-dos: Started with 48, ended with 35
Trefoils: Started with 36, ended with 30

Cash started at $300, ended at $867
Credit card sales: $492 on terminal 1, $180 on terminal 2
Venmo: $96
Donations: $15 cash, $10 credit
"

# 2. Validate the generated file
claude-code "Validate booth_import_2025-01-23.json"

# 3. Import to GSCTracker
curl -X POST http://localhost:3000/api/booth-sessions/import \
  -H "Content-Type: application/json" \
  -d @booth_import_2025-01-23.json
```

## Example Prompts for Claude Code

### 1. Generate Import from Scanned Sheet
```bash
claude-code "I have a scanned booth sheet. The data is:
- Location: Kroger East
- Date: 1/24/2025
- Shift: 10am-2pm
- Volunteers: Jenny Smith (10-12), Bob Jones (12-2)
- Inventory:
  * Thin Mints: 120 → 15
  * Samoas: 84 → 23
  * Tagalongs: 60 → 41
  * All others: 0
- Cash: start $300, end $753
- Credit: $246
- Perfect till

Create the JSON import file."
```

### 2. Quick Entry Mode
```bash
claude-code "Quick booth entry:
Walmart, today, 3-7pm
Mints 96→12, Samoas 72→8, Tags 60→15
Cash end $900, Credit $276, Venmo $120
Volunteers: Amy 2hrs, Dave 4hrs"
```

### 3. Batch Processing
```bash
claude-code "Convert all booth sheets in the 'scans' folder to import JSON files.
Use the naming pattern: booth_import_{location}_{date}.json
Each scan follows the standard booth sheet format."
```

### 4. Reconciliation Help
```bash
claude-code "Check my math on this booth sheet:
Sold: Mints 81, Samoas 73, Tags 44, Dosi 13, Trefoils 6
Total should be 217 boxes at $6 each = $1,302
But I collected: Cash $745, Credit $480, Venmo $96 = $1,321
Where's the $19 difference?"
```

### 5. Data Correction
```bash
claude-code "Fix this booth import file:
- The ending Thin Mints should be 12, not 21
- Add a third volunteer: Lisa, 2:30-4:30pm
- Total cash collected should be $867, not $687"
```

## Sample Import Files

### Minimal Valid Import
```json
{
  "boothSession": {
    "location": "Quick Shop",
    "date": "2025-01-23",
    "startTime": "14:00",
    "endTime": "18:00",
    "cashStatus": { "over": 0, "under": 0, "perfect": true }
  },
  "volunteers": [
    { "name": "Jane", "timeIn": "14:00", "timeOut": "18:00", "totalHours": 4.0 }
  ],
  "inventory": {
    "lemonUps": { "start": 0, "end": 0, "sold": 0 },
    "trefoils": { "start": 0, "end": 0, "sold": 0 },
    "doSiDos": { "start": 0, "end": 0, "sold": 0 },
    "samoas": { "start": 48, "end": 12, "sold": 36 },
    "tagalongs": { "start": 36, "end": 18, "sold": 18 },
    "thinMints": { "start": 96, "end": 24, "sold": 72 },
    "smores": { "start": 0, "end": 0, "sold": 0 },
    "toffeeTastic": { "start": 0, "end": 0, "sold": 0 },
    "adventurefuls": { "start": 0, "end": 0, "sold": 0 }
  },
  "payments": {
    "cash": { "start": 300.00, "end": 756.00 },
    "creditCard": { "card1": 0, "card2": 0 },
    "donations": { "cash": 0, "credit": 0 },
    "venmo": { "app1": 0, "app2": 0 }
  },
  "reconciliation": {
    "totalBoxes": 126,
    "totalSales": 756.00,
    "totalCollected": 756.00,
    "netSales": 456.00,
    "startingCash": 300.00,
    "pricePerBox": 6.00
  }
}
```

### Full Featured Import
```json
{
  "boothSession": {
    "location": "Walmart Supercenter - 123 Main St",
    "date": "2025-01-23",
    "startTime": "10:00",
    "endTime": "16:00",
    "cashStatus": {
      "over": 0,
      "under": 6.00,
      "perfect": false
    }
  },
  "volunteers": [
    { "name": "Sarah Johnson", "timeIn": "10:00", "timeOut": "13:00", "totalHours": 3.0 },
    { "name": "Mike Davis", "timeIn": "13:00", "timeOut": "16:00", "totalHours": 3.0 },
    { "name": "Emma Wilson", "timeIn": "10:00", "timeOut": "16:00", "totalHours": 6.0 }
  ],
  "inventory": {
    "lemonUps": { "start": 24, "end": 18, "sold": 6 },
    "trefoils": { "start": 36, "end": 28, "sold": 8 },
    "doSiDos": { "start": 48, "end": 32, "sold": 16 },
    "samoas": { "start": 96, "end": 23, "sold": 73 },
    "tagalongs": { "start": 72, "end": 28, "sold": 44 },
    "thinMints": { "start": 144, "end": 27, "sold": 117 },
    "smores": { "start": 24, "end": 21, "sold": 3 },
    "toffeeTastic": { "start": 24, "end": 22, "sold": 2 },
    "adventurefuls": { "start": 36, "end": 24, "sold": 12 }
  },
  "payments": {
    "cash": {
      "start": 300.00,
      "end": 891.00
    },
    "creditCard": {
      "card1": 720.00,
      "card2": 240.00
    },
    "donations": {
      "cash": 25.00,
      "credit": 15.00
    },
    "venmo": {
      "app1": 180.00,
      "app2": 96.00
    }
  },
  "reconciliation": {
    "totalBoxes": 281,
    "totalSales": 1686.00,
    "totalCollected": 2167.00,
    "netSales": 1867.00,
    "startingCash": 300.00,
    "pricePerBox": 6.00
  }
}
```

## Testing & Validation

### Local Validation Script
```javascript
// Save as validate_booth.js
const { BoothSheetValidator } = require('./cookie_booth_implementation.js');
const fs = require('fs');

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node validate_booth.js <filename.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const validator = new BoothSheetValidator();
const result = validator.validate(data);

if (result.isValid) {
  console.log('✓ Validation passed!');
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  - ${w.field}: ${w.message}`));
  }
} else {
  console.log('✗ Validation failed!\n');
  console.log('Errors:');
  result.errors.forEach(e => console.log(`  - ${e.field}: ${e.message}`));
}
```

### Test Import Locally
```bash
# Run validation
node validate_booth.js booth_import.json

# Test import (dry run)
curl -X POST http://localhost:3000/api/booth-sessions/validate \
  -H "Content-Type: application/json" \
  -d @booth_import.json | jq

# Actual import
curl -X POST http://localhost:3000/api/booth-sessions/import \
  -H "Content-Type: application/json" \
  -d @booth_import.json | jq
```

## Common Scenarios

### Scenario 1: Overnight Preparation
**Before the booth:**
```bash
claude-code "Create a blank booth sheet for tomorrow's sale at Target, 
2pm-6pm. Expected inventory: 144 Mints, 96 Samoas, 72 Tags, 48 Dosi. 
Volunteers: Sarah (full shift), Mike (2-4pm), Emma (4-6pm).
Starting cash: $300"
```

**After the booth:**
```bash
claude-code "Update booth_target_2025-01-24.json with actual sales:
Mints ended at 31, Samoas at 15, Tags at 25, Dosi at 38
Cash collected: $945, Credit: $456, Venmo: $102"
```

### Scenario 2: Multi-Location Management
```bash
# Generate template for multiple locations
claude-code "Create booth import templates for this weekend:
- Saturday: Target 10am-2pm, Walmart 2pm-6pm
- Sunday: Kroger 12pm-4pm, Costco 10am-2pm
All start with standard inventory mix"

# Import all at once
for file in booth_*.json; do
  curl -X POST http://localhost:3000/api/booth-sessions/import \
    -H "Content-Type: application/json" \
    -d @"$file"
  sleep 1
done
```

### Scenario 3: Error Recovery
```bash
# Find the problem
claude-code "Analyze booth_walmart_0123.json and tell me why 
the total collected doesn't match the expected sales"

# Fix and reimport
claude-code "Fix the cash reconciliation in booth_walmart_0123.json
The ending cash should include the $50 we used to make change"
```

## Integration with GSCTracker

### Setup Integration
```javascript
// In your GSCTracker app.js
const boothRoutes = require('./routes/booth-sessions');
app.use('/api/booth-sessions', boothRoutes);
```

### Query Booth Data
```bash
# Get specific session
curl http://localhost:3000/api/booth-sessions/{session-id}

# Get all sessions for a date range
curl "http://localhost:3000/api/booth-sessions?start=2025-01-01&end=2025-01-31"

# Get summary statistics
curl http://localhost:3000/api/booth-sessions/summary
```

## Tips for Claude Code Efficiency

### 1. Use Natural Language
Instead of formatting JSON manually:
```bash
claude-code "Booth at Target today from 3-7pm. 
Sold 81 Thin Mints, 73 Samoas, 44 Tagalongs.
Made $1,302 total. Sarah and Mike volunteered."
```

### 2. Leverage Context
If you've already created similar files:
```bash
claude-code "Create another booth file like the last one, 
but for Walmart tomorrow with different volunteers"
```

### 3. Batch Operations
```bash
claude-code "I have 5 booth sheets to enter. I'll give you the data 
for each one. Create separate import files named by location and date."
```

### 4. Auto-Calculate
```bash
claude-code "We sold these boxes: Mints 121, Samoas 84, Tags 52.
Calculate the total revenue and create the reconciliation section.
We collected cash only, started with $300."
```

### 5. Error Detection
```bash
claude-code "Review this booth data and flag any issues:
Started Mints: 144, Ended: 31, but I calculated 117 sold.
Total collected: $1,523, but total sales should be $1,536.
What's wrong?"
```

## Automation Ideas

### Weekly Report Generation
```bash
#!/bin/bash
# generate_weekly_report.sh

START_DATE="2025-01-20"
END_DATE="2025-01-26"

claude-code "Generate a weekly booth sales report from $START_DATE to $END_DATE.
Include: total boxes sold by type, total revenue, top locations, 
volunteer hours summary. Export as PDF."
```

### Inventory Alerts
```bash
claude-code "Check current inventory levels after today's booth imports.
Alert if any cookie type is below 100 boxes. Generate restock list."
```

### Performance Tracking
```bash
claude-code "Compare this week's booth performance to last week.
Show: boxes per hour, revenue per volunteer hour, 
most/least popular cookies, best performing locations."
```

## Troubleshooting

### Common Errors

**Error: "Sold value doesn't match start-end"**
```bash
claude-code "Recalculate all sold values in booth_file.json 
based on start minus end quantities"
```

**Error: "Total collected doesn't match expected sales"**
```bash
claude-code "Debug the reconciliation in booth_file.json.
Show me the step-by-step calculation and where it goes wrong."
```

**Error: "Invalid date format"**
```bash
claude-code "Convert all dates in booth_files/ to ISO format (YYYY-MM-DD)"
```

### Data Recovery
If an import fails partially:
```bash
# Check what was imported
curl http://localhost:3000/api/booth-sessions/recent

# Rollback if needed (if you implemented transactions)
curl -X POST http://localhost:3000/api/booth-sessions/{id}/rollback
```

## Best Practices

1. **Always validate before import**
   - Use the validation endpoint first
   - Review warnings even if validation passes

2. **Keep originals**
   - Don't overwrite original booth sheets
   - Save scanned PDFs for reference

3. **Regular backups**
   - Export booth data weekly
   - Keep JSON import files as backup

4. **Consistent naming**
   - Use: `booth_{location}_{YYYY-MM-DD}.json`
   - Makes batch operations easier

5. **Double-check math**
   - Let Claude Code verify calculations
   - Compare totals before finalizing import
