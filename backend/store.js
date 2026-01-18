// Store arrays of entries: { date, product, qty }
export const store = {
  plans: {},
  produced: [], // Array of { date, product, qty }
  sentToShop: [], // Array of { date, product, qty }
  sold: [], // Array of { date, product, qty }
  lastModified: {},
  history: [] // Array of { ts, date, type, action, product, notes } for manage product events
};




