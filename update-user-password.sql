-- Alterar senha do usuário MyMoney para a senha do arquivo de secret
ALTER USER 'MyMoney'@'%' IDENTIFIED BY 'MyMoney_secure_password_2024!';
FLUSH PRIVILEGES;

-- Verificar se a alteração foi bem-sucedida
SELECT User, Host FROM mysql.user WHERE User = 'MyMoney';
SHOW GRANTS FOR 'MyMoney'@'%';