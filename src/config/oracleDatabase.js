const oracledb = require('oracledb');

// Enables auto-commit by default for standard transactions
oracledb.autoCommit = true;

let pool = null;

/**
 * Initialize Oracle Connection Pool in modern Thin Mode (pure JS, zero Instant Client setup)
 */
async function initOraclePool() {
  const user = process.env.ORACLE_USER || 'ANCHOR_TRACK';
  const password = process.env.ORACLE_PASSWORD || 'AnchorCafe#2026';
  const connectString = process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1';

  try {
    pool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      poolTimeout: 60
    });

    console.log(`✅ [Oracle DB] Connected successfully to Oracle Database (${connectString}) as user "${user}".`);
    return pool;
  } catch (err) {
    console.warn(`⚠️ [Oracle DB] Could not connect to Oracle at ${connectString}: ${err.message}`);
    console.log('💡 [Oracle DB] Please ensure the ANCHOR_TRACK user has been created using setup_oracle_account.sql');
    return null;
  }
}

/**
 * Execute a SQL query with binds and return formatted objects
 */
async function executeQuery(sql, binds = [], opts = {}) {
  if (!pool) {
    throw new Error('Oracle DB connection pool is not initialized.');
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...opts
    });
    return result;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error('Error closing Oracle connection:', closeErr);
      }
    }
  }
}

async function closeOraclePool() {
  if (pool) {
    try {
      await pool.close(10);
      console.log('🔒 [Oracle DB] Connection pool closed.');
    } catch (err) {
      console.error('Error closing Oracle pool:', err);
    }
  }
}

module.exports = {
  initOraclePool,
  executeQuery,
  closeOraclePool
};
