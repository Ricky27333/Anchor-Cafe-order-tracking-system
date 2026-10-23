require('dotenv').config();
const { initOraclePool, executeQuery, closeOraclePool } = require('../config/oracleDatabase');

async function testConnection() {
  console.log('🔄 Testing connection to Oracle Database...');
  console.log(`📍 Host / Connect String: ${process.env.ORACLE_CONNECT_STRING}`);
  console.log(`👤 User: ${process.env.ORACLE_USER}`);

  const pool = await initOraclePool();
  if (!pool) {
    console.log('❌ Connection pool could not be established.');
    process.exit(1);
  }

  try {
    const res = await executeQuery('SELECT USER, SYSDATE, SYS_CONTEXT(\'USERENV\', \'CON_NAME\') AS CONTAINER FROM DUAL');
    console.log('🎉 Oracle DB Test Successful!');
    console.log('Query result:', res.rows[0]);

    // Check menu items table
    try {
      const itemsRes = await executeQuery('SELECT COUNT(*) AS COUNT FROM MENU_ITEMS');
      console.log(`📊 MENU_ITEMS table exists! Total items: ${itemsRes.rows[0].COUNT}`);
    } catch (tblErr) {
      console.log('ℹ️ Note: MENU_ITEMS table not yet created. Run setup_oracle_account.sql to create tables.');
    }
  } catch (err) {
    console.error('❌ Query execution failed:', err.message);
  } finally {
    await closeOraclePool();
    process.exit(0);
  }
}

testConnection();
