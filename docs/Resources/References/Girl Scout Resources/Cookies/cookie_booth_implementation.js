// Cookie Booth Sheet Import - Implementation Examples
// For use with GSCTracker application

// ============================================================================
// 1. DATA VALIDATION MODULE
// ============================================================================

class BoothSheetValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(boothData) {
    this.errors = [];
    this.warnings = [];

    this.validateMetadata(boothData.boothSession);
    this.validateVolunteers(boothData.volunteers);
    this.validateInventory(boothData.inventory);
    this.validatePayments(boothData.payments);
    this.validateReconciliation(boothData);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateMetadata(session) {
    if (!session.location || session.location.trim() === '') {
      this.errors.push({ field: 'location', message: 'Location is required' });
    }

    if (!session.date || !this.isValidDate(session.date)) {
      this.errors.push({ field: 'date', message: 'Valid date is required (YYYY-MM-DD)' });
    }

    // Validate cash status
    const { over, under, perfect } = session.cashStatus;
    if (perfect && (over > 0 || under > 0)) {
      this.warnings.push({
        field: 'cashStatus',
        message: 'Marked as perfect but has over/under amounts'
      });
    }
  }

  validateVolunteers(volunteers) {
    if (!volunteers || volunteers.length === 0) {
      this.errors.push({ field: 'volunteers', message: 'At least one volunteer is required' });
      return;
    }

    volunteers.forEach((vol, index) => {
      if (!vol.name || vol.name.trim() === '') {
        this.errors.push({
          field: `volunteers[${index}].name`,
          message: 'Volunteer name is required'
        });
      }

      // Validate time calculations
      if (vol.timeIn && vol.timeOut) {
        const calculatedHours = this.calculateHours(vol.timeIn, vol.timeOut);
        if (Math.abs(calculatedHours - vol.totalHours) > 0.1) {
          this.warnings.push({
            field: `volunteers[${index}].totalHours`,
            message: `Calculated hours (${calculatedHours}) doesn't match recorded (${vol.totalHours})`
          });
        }
      }
    });
  }

  validateInventory(inventory) {
    const cookieTypes = [
      'lemonUps', 'trefoils', 'doSiDos', 'samoas', 'tagalongs',
      'thinMints', 'smores', 'toffeeTastic', 'adventurefuls'
    ];

    cookieTypes.forEach(type => {
      const item = inventory[type];
      if (!item) {
        this.errors.push({
          field: `inventory.${type}`,
          message: 'Cookie type data is missing'
        });
        return;
      }

      // Validate sold calculation
      const calculatedSold = item.start - item.end;
      if (calculatedSold !== item.sold) {
        this.errors.push({
          field: `inventory.${type}.sold`,
          message: `Sold should be ${calculatedSold} (${item.start} - ${item.end}), but is ${item.sold}`
        });
      }

      // Check for negative values
      if (item.start < 0 || item.end < 0 || item.sold < 0) {
        this.errors.push({
          field: `inventory.${type}`,
          message: 'Negative inventory values are not allowed'
        });
      }

      // Warning if end > start
      if (item.end > item.start) {
        this.warnings.push({
          field: `inventory.${type}`,
          message: 'Ending inventory is greater than starting inventory'
        });
      }
    });
  }

  validatePayments(payments) {
    // Validate cash
    if (!payments.cash || payments.cash.start === undefined) {
      this.errors.push({
        field: 'payments.cash.start',
        message: 'Starting cash is required'
      });
    }

    if (payments.cash && payments.cash.end < payments.cash.start) {
      this.warnings.push({
        field: 'payments.cash',
        message: 'Ending cash is less than starting cash (did you make change?)'
      });
    }

    // Validate all payment amounts are non-negative
    const allPayments = [
      payments.cash?.start,
      payments.cash?.end,
      payments.creditCard?.card1,
      payments.creditCard?.card2,
      payments.donations?.cash,
      payments.donations?.credit,
      payments.venmo?.app1,
      payments.venmo?.app2
    ];

    allPayments.forEach((amount, index) => {
      if (amount !== undefined && amount < 0) {
        this.errors.push({
          field: 'payments',
          message: 'Payment amounts cannot be negative'
        });
      }
    });
  }

  validateReconciliation(boothData) {
    const { inventory, payments, reconciliation } = boothData;

    // Calculate total boxes sold
    let calculatedBoxes = 0;
    Object.values(inventory).forEach(item => {
      calculatedBoxes += item.sold || 0;
    });

    if (calculatedBoxes !== reconciliation.totalBoxes) {
      this.errors.push({
        field: 'reconciliation.totalBoxes',
        message: `Total boxes should be ${calculatedBoxes}, but is ${reconciliation.totalBoxes}`
      });
    }

    // Calculate total sales
    const calculatedSales = calculatedBoxes * reconciliation.pricePerBox;
    if (Math.abs(calculatedSales - reconciliation.totalSales) > 0.01) {
      this.errors.push({
        field: 'reconciliation.totalSales',
        message: `Total sales should be $${calculatedSales.toFixed(2)}, but is $${reconciliation.totalSales.toFixed(2)}`
      });
    }

    // Calculate total collected
    const calculatedCollected =
      (payments.cash?.end || 0) +
      (payments.creditCard?.card1 || 0) +
      (payments.creditCard?.card2 || 0) +
      (payments.donations?.cash || 0) +
      (payments.donations?.credit || 0) +
      (payments.venmo?.app1 || 0) +
      (payments.venmo?.app2 || 0);

    if (Math.abs(calculatedCollected - reconciliation.totalCollected) > 0.01) {
      this.errors.push({
        field: 'reconciliation.totalCollected',
        message: `Total collected should be $${calculatedCollected.toFixed(2)}, but is $${reconciliation.totalCollected.toFixed(2)}`
      });
    }

    // Calculate net sales
    const calculatedNetSales = reconciliation.totalCollected - reconciliation.startingCash;
    if (Math.abs(calculatedNetSales - reconciliation.netSales) > 0.01) {
      this.errors.push({
        field: 'reconciliation.netSales',
        message: `Net sales should be $${calculatedNetSales.toFixed(2)}, but is $${reconciliation.netSales.toFixed(2)}`
      });
    }

    // Check if cash balances
    const cashDifference = reconciliation.totalSales - reconciliation.netSales;
    if (Math.abs(cashDifference) > 0.01) {
      const status = cashDifference > 0 ? 'under' : 'over';
      const amount = Math.abs(cashDifference);
      this.warnings.push({
        field: 'reconciliation',
        message: `Cash is ${status} by $${amount.toFixed(2)}`
      });
    }
  }

  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  calculateHours(timeIn, timeOut) {
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };
    return parseTime(timeOut) - parseTime(timeIn);
  }
}

// ============================================================================
// 2. IMPORT SERVICE
// ============================================================================

class BoothSheetImportService {
  constructor(database) {
    this.db = database;
    this.validator = new BoothSheetValidator();
  }

  async import(boothData) {
    // Validate first
    const validation = this.validator.validate(boothData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
    }

    // Start transaction
    const session = await this.db.transaction();

    try {
      // Insert booth session
      const sessionId = await this.insertBoothSession(boothData.boothSession, session);

      // Insert volunteers
      await this.insertVolunteers(sessionId, boothData.volunteers, session);

      // Insert inventory
      await this.insertInventory(sessionId, boothData.inventory, session);

      // Insert payments
      await this.insertPayments(sessionId, boothData.payments, session);

      // Update overall inventory levels
      await this.updateInventoryLevels(boothData.inventory, session);

      // Commit transaction
      await session.commit();

      return {
        success: true,
        sessionId: sessionId,
        summary: this.generateSummary(boothData),
        warnings: validation.warnings
      };
    } catch (error) {
      await session.rollback();
      throw error;
    }
  }

  async insertBoothSession(sessionData, transaction) {
    const query = `
      INSERT INTO booth_sessions (
        id, location, date, start_time, end_time,
        cash_over, cash_under, is_perfect, starting_cash
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id
    `;

    const result = await transaction.query(query, [
      sessionData.location,
      sessionData.date,
      sessionData.startTime,
      sessionData.endTime,
      sessionData.cashStatus.over,
      sessionData.cashStatus.under,
      sessionData.cashStatus.perfect,
      300.00 // Default starting cash
    ]);

    return result.rows[0].id;
  }

  async insertVolunteers(sessionId, volunteers, transaction) {
    const query = `
      INSERT INTO booth_volunteers (
        id, session_id, name, time_in, time_out, total_hours
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5
      )
    `;

    for (const volunteer of volunteers) {
      await transaction.query(query, [
        sessionId,
        volunteer.name,
        volunteer.timeIn,
        volunteer.timeOut,
        volunteer.totalHours
      ]);
    }
  }

  async insertInventory(sessionId, inventory, transaction) {
    const query = `
      INSERT INTO booth_inventory (
        id, session_id, cookie_type, start_quantity, end_quantity
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4
      )
    `;

    const cookieTypes = {
      lemonUps: 'lemonUps',
      trefoils: 'trefoils',
      doSiDos: 'doSiDos',
      samoas: 'samoas',
      tagalongs: 'tagalongs',
      thinMints: 'thinMints',
      smores: 'smores',
      toffeeTastic: 'toffeeTastic',
      adventurefuls: 'adventurefuls'
    };

    for (const [key, type] of Object.entries(cookieTypes)) {
      const item = inventory[key];
      await transaction.query(query, [
        sessionId,
        type,
        item.start,
        item.end
      ]);
    }
  }

  async insertPayments(sessionId, payments, transaction) {
    const query = `
      INSERT INTO booth_payments (
        id, session_id, payment_type, sub_type, amount
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4
      )
    `;

    const paymentEntries = [
      ['cash', 'start', payments.cash.start],
      ['cash', 'end', payments.cash.end],
      ['credit', 'card1', payments.creditCard.card1],
      ['credit', 'card2', payments.creditCard.card2],
      ['donation', 'cash', payments.donations.cash],
      ['donation', 'credit', payments.donations.credit],
      ['venmo', 'app1', payments.venmo.app1],
      ['venmo', 'app2', payments.venmo.app2]
    ];

    for (const [type, subType, amount] of paymentEntries) {
      if (amount > 0) {
        await transaction.query(query, [sessionId, type, subType, amount]);
      }
    }
  }

  async updateInventoryLevels(inventory, transaction) {
    // Update overall inventory levels by subtracting sold quantities
    // This assumes you have a separate inventory_levels table
    const query = `
      UPDATE inventory_levels
      SET quantity = quantity - $1
      WHERE cookie_type = $2
    `;

    for (const [cookieType, data] of Object.entries(inventory)) {
      if (data.sold > 0) {
        await transaction.query(query, [data.sold, cookieType]);
      }
    }
  }

  generateSummary(boothData) {
    const totalBoxes = boothData.reconciliation.totalBoxes;
    const totalRevenue = boothData.reconciliation.totalSales;
    const volunteersCount = boothData.volunteers.length;

    const startTime = boothData.boothSession.startTime;
    const endTime = boothData.boothSession.endTime;
    const duration = this.calculateDuration(startTime, endTime);

    return {
      totalBoxesSold: totalBoxes,
      totalRevenue: totalRevenue,
      volunteersCount: volunteersCount,
      duration: duration
    };
  }

  calculateDuration(startTime, endTime) {
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const minutes = end - start;
    const hours = Math.floor(minutes / 60);

    return `${hours} hours`;
  }
}

// ============================================================================
// 3. EXPRESS API ROUTES
// ============================================================================

const express = require('express');
const router = express.Router();

// POST /api/booth-sessions/import
router.post('/import', async (req, res) => {
  try {
    const boothData = req.body.data;
    const importService = new BoothSheetImportService(req.db);

    const result = await importService.import(boothData);

    res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/booth-sessions/validate
router.post('/validate', (req, res) => {
  try {
    const boothData = req.body.data;
    const validator = new BoothSheetValidator();

    const validation = validator.validate(boothData);

    res.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/booth-sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = await req.db.query(
      'SELECT * FROM booth_sessions WHERE id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get related data
    const volunteers = await req.db.query(
      'SELECT * FROM booth_volunteers WHERE session_id = $1',
      [sessionId]
    );

    const inventory = await req.db.query(
      'SELECT * FROM booth_inventory WHERE session_id = $1',
      [sessionId]
    );

    const payments = await req.db.query(
      'SELECT * FROM booth_payments WHERE session_id = $1',
      [sessionId]
    );

    res.json({
      session: session.rows[0],
      volunteers: volunteers.rows,
      inventory: inventory.rows,
      payments: payments.rows
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// ============================================================================
// 4. CLAUDE CODE HELPER FUNCTIONS
// ============================================================================

// Helper function to convert manual entry to JSON format
function manualEntryToJSON(manualData) {
  // Example usage:
  // const manualData = `
  //   Location: Walmart
  //   Date: 1/23/2025
  //   Time: 10:00 - 14:00
  //   Thin Mints: Start 144, End 23
  //   Samoas: Start 96, End 12
  //   ...
  // `;

  const lines = manualData.split('\n').map(l => l.trim()).filter(l => l);
  const result = {
    boothSession: {
      cashStatus: { over: 0, under: 0, perfect: true }
    },
    volunteers: [],
    inventory: {},
    payments: {
      cash: { start: 300.00 },
      creditCard: {},
      donations: {},
      venmo: {}
    },
    reconciliation: {
      startingCash: 300.00,
      pricePerBox: 6.00
    }
  };

  // Parse each line
  lines.forEach(line => {
    // Location
    if (line.startsWith('Location:')) {
      result.boothSession.location = line.split(':')[1].trim();
    }
    // Date
    else if (line.startsWith('Date:')) {
      const dateStr = line.split(':')[1].trim();
      result.boothSession.date = convertToISODate(dateStr);
    }
    // Time
    else if (line.startsWith('Time:')) {
      const timeStr = line.split(':').slice(1).join(':').trim();
      const [start, end] = timeStr.split('-').map(t => t.trim());
      result.boothSession.startTime = convertTo24Hour(start);
      result.boothSession.endTime = convertTo24Hour(end);
    }
    // Cookie inventory (pattern: "Cookie Name: Start X, End Y")
    else if (line.includes('Start') && line.includes('End')) {
      const [cookiePart, dataPart] = line.split(':');
      const cookieName = normalizeCookieName(cookiePart.trim());
      const startMatch = dataPart.match(/Start\s+(\d+)/i);
      const endMatch = dataPart.match(/End\s+(\d+)/i);

      if (startMatch && endMatch) {
        const start = parseInt(startMatch[1]);
        const end = parseInt(endMatch[1]);
        result.inventory[cookieName] = {
          start,
          end,
          sold: start - end
        };
      }
    }
  });

  return result;
}

function normalizeCookieName(name) {
  const mapping = {
    'thin mints': 'thinMints',
    'samoas': 'samoas',
    'caramel delites': 'samoas',
    'tagalongs': 'tagalongs',
    'peanut butter patties': 'tagalongs',
    'do-si-dos': 'doSiDos',
    'trefoils': 'trefoils',
    'lemon-ups': 'lemonUps',
    's\'mores': 'smores',
    'toffee-tastic': 'toffeeTastic',
    'adventurefuls': 'adventurefuls'
  };

  const normalized = name.toLowerCase().trim();
  return mapping[normalized] || name.replace(/[^a-zA-Z]/g, '');
}

function convertToISODate(dateStr) {
  // Convert formats like "1/23/2025" to "2025-01-23"
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function convertTo24Hour(timeStr) {
  // Convert "2:00 PM" to "14:00" or keep "14:00" as is
  if (timeStr.includes('PM') || timeStr.includes('AM')) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return timeStr;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BoothSheetValidator,
    BoothSheetImportService,
    manualEntryToJSON,
    normalizeCookieName,
    convertToISODate,
    convertTo24Hour
  };
}
