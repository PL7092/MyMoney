-- Script para configurar usuário MyMoney no MariaDB externo
-- Execute este script no MariaDB externo como root

-- Criar base de dados se não existir
CREATE DATABASE IF NOT EXISTS mymoney CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário MyMoney se não existir
-- NOTA: Substitua @DB_PASSWORD pela senha real do secret antes de executar
CREATE USER IF NOT EXISTS 'MyMoney'@'%' IDENTIFIED BY '@DB_PASSWORD';

-- Conceder privilégios
GRANT ALL PRIVILEGES ON mymoney.* TO 'MyMoney'@'%';

-- Aplicar alterações
FLUSH PRIVILEGES;

-- Verificar se o usuário foi criado
SELECT User, Host FROM mysql.user WHERE User='MyMoney';

-- Mostrar privilégios do usuário
SHOW GRANTS FOR 'MyMoney'@'%';