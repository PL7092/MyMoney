# Guia de Migração - MyMoney v2.0

Este guia ajuda na migração do sistema antigo para a nova versão com autenticação JWT, cache Redis e outras melhorias.

## 📋 Resumo das Mudanças

### 🔄 Mudanças na Arquitetura
- **Novo ponto de entrada**: `server/server.js` (antes: `server/index.js`)
- **Autenticação JWT**: Substitui sistema de sessão simples
- **Cache Redis**: Para melhor performance
- **Backup automático**: Agendado com node-cron
- **Logging estruturado**: Com Winston
- **Segurança aprimorada**: Rate limiting, Helmet, validação

### 🗄️ Mudanças no Banco de Dados
- **Nova tabela**: `refresh_tokens`
- **Tabela users atualizada**: Novos campos para autenticação
- **Índices adicionados**: Para melhor performance

## 🚀 Processo de Migração

### 1. Backup dos Dados Atuais
```bash
# Fazer backup manual antes da migração
mysqldump -u finance_user -p personal_finance > backup_pre_migration.sql
```

### 2. Atualizar Variáveis de Ambiente
```bash
# Copiar novo template
cp .env.example .env

# Adicionar novas variáveis obrigatórias:
JWT_SECRET=your-super-secret-jwt-key-2024
JWT_REFRESH_SECRET=your-super-secret-refresh-key-2024
REDIS_URL=redis://redis:6379
BCRYPT_ROUNDS=12
```

### 3. Executar Migração do Schema
O novo schema será aplicado automaticamente na inicialização. As mudanças incluem:

```sql
-- Nova tabela para refresh tokens
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);

-- Novos campos na tabela users
ALTER TABLE users 
ADD COLUMN password VARCHAR(255) AFTER email,
ADD COLUMN last_login TIMESTAMP NULL,
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN two_factor_secret VARCHAR(255) NULL;

-- Novos índices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### 4. Migração de Usuários Existentes
```javascript
// Script para migrar usuários existentes (executar uma vez)
const bcrypt = require('bcrypt');
const { DatabaseService } = require('./server/db-commonjs');

async function migrateUsers() {
  const db = new DatabaseService();
  await db.init();
  
  // Buscar usuários sem senha
  const users = await db.query('SELECT * FROM users WHERE password IS NULL');
  
  for (const user of users) {
    // Gerar senha temporária
    const tempPassword = 'temp123'; // Usuário deve alterar no primeiro login
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    
    await db.query(
      'UPDATE users SET password = ?, is_active = TRUE, email_verified = TRUE WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    console.log(`Usuário ${user.email} migrado com senha temporária`);
  }
  
  await db.close();
}
```

## 🔄 Mudanças na API

### Autenticação
**Antes:**
```javascript
// Sistema simples sem autenticação robusta
app.get('/api/user-settings', (req, res) => {
  // Sem verificação de autenticação
});
```

**Depois:**
```javascript
// JWT obrigatório para rotas protegidas
app.get('/api/user-settings', authenticateToken, (req, res) => {
  // req.user contém dados do usuário autenticado
});
```

### Headers Obrigatórios
```bash
# Todas as rotas protegidas agora requerem:
Authorization: Bearer <jwt-token>
```

### Novas Rotas de Autenticação
```bash
POST /api/auth/register    # Registro de usuário
POST /api/auth/login       # Login
POST /api/auth/refresh     # Renovar token
POST /api/auth/logout      # Logout
```

## 🎯 Migração do Frontend

### 1. Gerenciamento de Tokens
```javascript
// Armazenar tokens no localStorage ou sessionStorage
const authService = {
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },
  
  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  },
  
  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};
```

### 2. Interceptor para Requisições
```javascript
// Adicionar token automaticamente
axios.interceptors.request.use(config => {
  const token = authService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Renovar token automaticamente
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        const refreshToken = authService.getRefreshToken();
        const response = await axios.post('/api/auth/refresh', {
          refreshToken
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        authService.setTokens(accessToken, newRefreshToken);
        
        // Repetir requisição original
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return axios.request(error.config);
      } catch (refreshError) {
        authService.clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 3. Componente de Login
```javascript
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      const { accessToken, refreshToken, user } = response.data;
      authService.setTokens(accessToken, refreshToken);
      
      // Redirecionar para dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Erro no login:', error.response?.data?.message);
    }
  };
  
  return (
    <form onSubmit={handleLogin}>
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required 
      />
      <input 
        type="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Senha"
        required 
      />
      <button type="submit">Entrar</button>
    </form>
  );
};
```

## 🔧 Configuração de Desenvolvimento

### Docker Compose
```bash
# Parar containers antigos
docker-compose down

# Remover volumes se necessário (CUIDADO: apaga dados)
docker-compose down -v

# Iniciar nova versão
docker-compose up --build
```

### Variáveis de Desenvolvimento
```env
NODE_ENV=development
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
DB_HOST=localhost
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## ✅ Checklist de Migração

### Preparação
- [ ] Backup dos dados atuais
- [ ] Configurar variáveis de ambiente
- [ ] Testar conexão com Redis
- [ ] Verificar dependências do Node.js

### Migração do Backend
- [ ] Aplicar novo schema do banco
- [ ] Migrar usuários existentes
- [ ] Testar autenticação JWT
- [ ] Verificar cache Redis
- [ ] Testar backup automático

### Migração do Frontend
- [ ] Implementar gerenciamento de tokens
- [ ] Adicionar interceptors HTTP
- [ ] Criar telas de login/registro
- [ ] Atualizar rotas protegidas
- [ ] Testar renovação automática de tokens

### Testes
- [ ] Login/logout funcionando
- [ ] Rotas protegidas bloqueadas sem token
- [ ] Cache funcionando
- [ ] Backup sendo criado
- [ ] Logs sendo gerados

## 🚨 Problemas Comuns

### 1. Erro "Redis connection failed"
```bash
# Verificar se Redis está rodando
docker-compose ps redis

# Verificar logs
docker-compose logs redis
```

### 2. Erro "JWT malformed"
```javascript
// Verificar se token está sendo enviado corretamente
console.log('Token:', localStorage.getItem('accessToken'));
```

### 3. Erro de CORS
```javascript
// Verificar ALLOWED_ORIGINS no .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 4. Usuários não conseguem fazer login
```sql
-- Verificar se usuários têm senha
SELECT id, email, password IS NOT NULL as has_password FROM users;

-- Resetar senha se necessário
UPDATE users SET password = '$2b$12$...' WHERE email = 'user@email.com';
```

## 📞 Suporte

Se encontrar problemas durante a migração:

1. Verificar logs: `docker-compose logs app`
2. Testar serviços: `node test-services.js`
3. Verificar health check: `curl http://localhost:3000/health`

## 🎉 Pós-Migração

Após a migração bem-sucedida:

1. **Monitorar logs** por alguns dias
2. **Verificar performance** com cache Redis
3. **Testar backup automático**
4. **Treinar usuários** no novo sistema de login
5. **Documentar** configurações específicas do ambiente

A migração está completa quando todos os itens do checklist estiverem marcados e o sistema estiver funcionando normalmente com as novas funcionalidades.