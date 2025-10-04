# MyMoney - Personal Finance Manager

Uma aplicação completa de gestão financeira pessoal com acesso público, cache Redis, backup automático e **instalação automática**. Funciona sem necessidade de login ou autenticação.

## 🎯 Versão de Acesso Público

Esta versão foi especialmente desenvolvida para funcionar **automaticamente** em qualquer ambiente sem necessidade de autenticação:

- ✅ **Acesso público** - sem necessidade de login
- ✅ **Instalação automática** de dependências
- ✅ **Fallbacks inteligentes** (Redis → Memória)
- ✅ **Verificações automáticas** de saúde dos serviços
- ✅ **Inicialização automática** do banco de dados
- ✅ **Scripts de teste** completos
- ✅ **Configuração automática** do ambiente

## 🚀 Início Rápido com Docker Compose

### Pré-requisitos
- Docker
- Docker Compose

### Instalação e Execução

1. **Clone o repositório**:
```bash
git clone <repository-url>
cd Mymoney
```

2. **Configure as variáveis de ambiente**:
```bash
cp .env.example .env
# Edite o arquivo .env se necessário (configurações padrão funcionam)
```

3. **Inicie todos os serviços**:
```bash
# Construir e iniciar todos os serviços
docker-compose up --build

# Ou em background
docker-compose up -d --build
```

4. **Configure os Docker Secrets** (IMPORTANTE para segurança):
```bash
# Execute o script de configuração automática
.\setup-secrets.ps1

# Ou crie manualmente os arquivos em secrets/
# Veja secrets/README.md para instruções detalhadas
```

5. **Acesse a aplicação**:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## 🔐 Segurança com Docker Secrets

Esta aplicação utiliza **Docker Secrets** para proteger informações sensíveis como passwords e chaves JWT. 

### ⚠️ IMPORTANTE - Segurança
- Os arquivos de secrets **NÃO** são commitados no Git
- O diretório `secrets/` está no `.gitignore`
- **NUNCA** partilhe os arquivos de secrets publicamente
- Em produção, use serviços de gestão de secrets apropriados

### Configuração Automática
```bash
# Execute o script para configurar todos os secrets automaticamente
.\setup-secrets.ps1
```

### Configuração Manual
Crie os seguintes arquivos no diretório `secrets/`:
- `db_password.txt` - Senha do banco de dados
- `db_root_password.txt` - Senha root do banco
- `jwt_secret.txt` - Chave JWT (64+ caracteres)
- `jwt_refresh_secret.txt` - Chave JWT refresh (64+ caracteres)  
- `redis_password.txt` - Senha do Redis

Consulte `secrets/README.md` para instruções detalhadas.

### Comandos Docker Compose Úteis

```bash
# Parar todos os serviços
docker-compose down

# Ver logs dos serviços
docker-compose logs

# Ver logs de um serviço específico
docker-compose logs app
docker-compose logs mariadb
docker-compose logs redis

# Reiniciar um serviço específico
docker-compose restart app

# Ver status dos serviços
docker-compose ps

# Executar comandos dentro do container
docker-compose exec app bash
```

## 🚀 Funcionalidades Implementadas

### ✅ Gestão Financeira Completa
- **Gestão de Transações** - adicionar, editar, excluir transações
- **Gestão de Contas** - múltiplas contas bancárias
- **Gestão de Categorias** - organização por categorias
- **Orçamentos** - definir e acompanhar orçamentos
- **Investimentos** - controle de carteira de investimentos
- **Metas de Poupança** - definir e acompanhar objetivos
- **Relatórios** - análises e gráficos detalhados
- **Importação/Exportação** - dados em CSV/Excel

### ✅ Recursos Avançados
- **IA Advisor** - conselhos financeiros inteligentes
- **ChatBot** - assistente virtual para dúvidas
- **Transações Recorrentes** - automatização de lançamentos
- **Notificações** - alertas e lembretes
- **Dashboard Interativo** - visão geral das finanças

### ✅ Performance e Cache
- **Redis Cache** para otimização de consultas
- **Compression** para reduzir tamanho das respostas
- **Cache middleware** para rotas GET
- **TTL configurável** para diferentes tipos de cache

### ✅ Backup e Monitoramento
- **Backup automático** do banco de dados MariaDB
- **Agendamento** com node-cron
- **Compressão** de backups com gzip
- **Limpeza automática** de backups antigos
- **Logging estruturado** com Winston

### ✅ Infraestrutura
- **Docker Compose** com MariaDB e Redis
- **Health checks** para todos os serviços
- **Graceful shutdown** do servidor
- **Variáveis de ambiente** configuráveis

## 📁 Estrutura do Projeto

```
Mymoney/
├── server/
│   ├── services/           # Serviços completos
│   │   ├── CacheService.js        # Cache Redis + Fallback Memória
│   │   ├── BackupService.js       # Backup automático
│   │   ├── LoggerService.js       # Logging estruturado
│   │   ├── HealthCheckService.js  # Verificações de saúde
│   │   └── DatabaseInitService.js # Inicialização automática DB
│   ├── middleware/         # Middlewares de segurança
│   │   └── security.js        # Validação e sanitização
│   ├── routes/            # Rotas organizadas
│   │   ├── legacy.js         # Rotas principais da aplicação
│   │   └── prompts.js        # Rotas para IA
│   ├── app.js             # Aplicação principal
│   ├── server.js          # Ponto de entrada
│   ├── db-commonjs.js     # DatabaseService compatível
│   └── index.js           # Servidor original (mantido)
├── src/                   # Frontend React
│   ├── components/        # Componentes da interface
│   ├── contexts/          # Contextos React
│   ├── pages/            # Páginas da aplicação
│   ├── services/         # Serviços frontend
│   └── utils/            # Utilitários
├── sql/
│   └── init.sql           # Schema do banco de dados
├── docker-compose.yml     # Configuração Docker
├── Dockerfile            # Imagem da aplicação
├── .env.example          # Variáveis de ambiente
└── package.json          # Dependências
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente Principais

```env
# Aplicação
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Banco de Dados
DB_HOST=mariadb
DB_PORT=3306
DB_USER=MyMoney
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=mymoney
DB_CONNECTION_LIMIT=10

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=/app/backups

# Logging
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log
```

## 📊 API Endpoints Principais

### Status do Sistema
```bash
GET /api/database/status
# Verifica conectividade com o banco de dados
```

### Gestão de Dados
```bash
# Configurações do usuário
GET /api/user/settings
PUT /api/user/settings

# Categorias
GET /api/categories
POST /api/categories
PUT /api/categories/:id
DELETE /api/categories/:id

# Contas
GET /api/accounts
POST /api/accounts
PUT /api/accounts/:id
DELETE /api/accounts/:id

# Transações
GET /api/transactions
POST /api/transactions
PUT /api/transactions/:id
DELETE /api/transactions/:id

# Orçamentos
GET /api/budgets
POST /api/budgets
PUT /api/budgets/:id
DELETE /api/budgets/:id
```

## 🔄 Gestão de Cache

### Informações do Cache
```bash
GET /api/cache/info
```

### Limpar Cache
```bash
DELETE /api/cache/flush
```

## 💾 Gestão de Backup

### Criar Backup Manual
```bash
POST /api/backup/create
```

### Listar Backups
```bash
GET /api/backup/list
```

### Restaurar Backup
```bash
POST /api/backup/restore
Content-Type: application/json

{
  "filename": "backup-2024-01-15.sql.gz"
}
```

## 📝 Logs

Os logs são salvos em:
- Console (desenvolvimento)
- Arquivo `/app/logs/app.log` (produção)
- Rotação automática de logs

Níveis de log: `error`, `warn`, `info`, `debug`

## 🐳 Docker

### Serviços Incluídos
- **app**: Aplicação Node.js + Frontend React
- **mariadb**: Banco de dados
- **redis**: Cache e otimização

### Volumes Persistentes
- `mariadb_data`: Dados do banco
- `redis_data`: Dados do Redis
- `app_uploads`: Arquivos enviados
- `app_logs`: Logs da aplicação
- `app_backups`: Backups do banco

### Portas Expostas
- **3000**: API Backend
- **3001**: Frontend React
- **3306**: MariaDB (apenas interno)
- **6379**: Redis (apenas interno)

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com Redis**
   ```bash
   # Verificar se Redis está rodando
   docker-compose ps redis
   
   # Ver logs do Redis
   docker-compose logs redis
   ```

2. **Erro de conexão com MariaDB**
   ```bash
   # Verificar logs do banco
   docker-compose logs mariadb
   
   # Verificar se o banco inicializou corretamente
   docker-compose exec mariadb mysql -u MyMoney -p -e "SHOW DATABASES;"
   ```

3. **Aplicação não carrega**
   ```bash
   # Verificar logs da aplicação
   docker-compose logs app
   
   # Verificar se todos os serviços estão rodando
   docker-compose ps
   ```

4. **Problemas de permissão**
   ```bash
   # Verificar permissões dos volumes
   docker-compose exec app ls -la /app/
   ```

5. **Reiniciar todos os serviços**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

## 🚀 Funcionalidades da Interface

### Dashboard Principal
- Visão geral das finanças
- Gráficos de receitas e despesas
- Saldo atual das contas
- Transações recentes

### Gestão de Transações
- Adicionar/editar/excluir transações
- Filtros por data, categoria, conta
- Importação de arquivos CSV/Excel
- Categorização automática com IA

### Relatórios e Análises
- Gráficos de tendências
- Análise por categorias
- Comparação mensal/anual
- Exportação de relatórios

### Ferramentas Avançadas
- IA Advisor para conselhos financeiros
- ChatBot para suporte
- Configurações personalizáveis
- Backup e restauração de dados

## 📈 Próximos Passos

- [ ] Testes automatizados
- [ ] Métricas avançadas com Prometheus
- [ ] Notificações por email
- [ ] API de relatórios avançados
- [ ] Integração com bancos (Open Banking)
- [ ] App mobile

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

**Nota**: Esta aplicação foi modificada para funcionar sem autenticação, permitindo acesso público a todas as funcionalidades. Todos os dados são armazenados sob um usuário público padrão.