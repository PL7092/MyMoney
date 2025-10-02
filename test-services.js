const { DatabaseService } = require('./server/db-commonjs');
const { logger } = require('./server/services/LoggerService');
const { cache } = require('./server/services/CacheService');
const { backup } = require('./server/services/BackupService');

async function testServices() {
  console.log('🧪 Testando serviços...\n');

  // Test Logger Service
  try {
    logger.info('Teste do LoggerService');
    console.log('✅ LoggerService: OK');
  } catch (error) {
    console.log('❌ LoggerService: ERRO -', error.message);
  }

  // Test Database Service
  try {
    const db = new DatabaseService();
    await db.init();
    console.log('✅ DatabaseService: OK');
    await db.close();
  } catch (error) {
    console.log('❌ DatabaseService: ERRO -', error.message);
  }

  // Test Cache Service
  try {
    await cache.connect();
    await cache.set('test', 'value', 60);
    const value = await cache.get('test');
    if (value === 'value') {
      console.log('✅ CacheService: OK');
    } else {
      console.log('❌ CacheService: ERRO - Valor não corresponde');
    }
    await cache.del('test');
  } catch (error) {
    console.log('❌ CacheService: ERRO -', error.message);
  }

  // Test Backup Service
  try {
    const stats = backup.getBackupStats();
    console.log('✅ BackupService: OK');
  } catch (error) {
    console.log('❌ BackupService: ERRO -', error.message);
  }

  console.log('\n🎉 Teste de serviços concluído!');
  process.exit(0);
}

testServices().catch(error => {
  console.error('❌ Erro geral:', error);
  process.exit(1);
});