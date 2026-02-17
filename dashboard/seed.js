/**
 * Reset / initialize the database.
 *
 * Run with: node seed.js
 *
 * This creates a fresh empty database with the schema ready to go.
 * Use the dashboard UI to add real alumni, import CSVs, or run
 * the Discover Alumni feature to find UniMelb founders via Google.
 */
const { db } = require('./db');

console.log('Database initialized.');
console.log('');
console.log('The database is empty and ready for real data.');
console.log('');
console.log('Next steps:');
console.log('  1. Start the server:  node server.js');
console.log('  2. Add alumni manually via the UI');
console.log('  3. Import a CSV via the Import page');
console.log('  4. Use Discover Alumni to find UniMelb founders via Google');
console.log('  5. Run the pipeline to scan data sources for signals');
