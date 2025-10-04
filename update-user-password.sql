-- Alterar senha do usuário MyMoney para a senha do arquivo de secret
-- NOTA: Substitua @DB_PASSWORD pela senha real do secret antes de executar
ALTER USER 'MyMoney'@'%' IDENTIFIED BY '@DB_PASSWORD';
FLUSH PRIVILEGES;

-- Verificar se a alteração foi bem-sucedida
SELECT User, Host FROM mysql.user WHERE User = 'MyMoney';
SHOW GRANTS FOR 'MyMoney'@'%';