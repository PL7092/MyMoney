# 🐳 MyMoney - Guia de Deploy Docker

Este guia fornece instruções completas para fazer deploy da aplicação MyMoney usando Docker em ambiente de produção.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração Inicial](#configuração-inicial)
3. [Deploy com Docker Compose](#deploy-com-docker-compose)
4. [Deploy em Unraid](#deploy-em-unraid)
5. [Configuração de Produção](#configuração-de-produção)
6. [Monitoramento e Logs](#monitoramento-e-logs)
7. [Backup e Manutenção](#backup-e-manutenção)
8. [Solução de Problemas](#solução-de-problemas)
9. [Segurança](#segurança)
10. [Performance e Otimização](#performance-e-otimização)

## 🔧 Pré-requisitos

### Sistema Operacional
- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **Windows**: Windows 10/11 com WSL2
- **macOS**: macOS 10.15+
- **Unraid**: 6.9.0+

### Software Necessário
- **Docker**: 20.10.0+
- **Docker Compose**: 2.0.0+
- **Git**: Para clonar o repositório
- **Mínimo 2GB RAM**: Recomendado 4GB+
- **Mínimo 10GB espaço**: Recomendado 50GB+

### Verificação de Pré-requisitos
```bash
# Verificar Docker
docker --version
docker compose version

# Verificar recursos do sistema
free -h
df -h

# Verificar portas disponíveis
netstat -tuln | grep -E ':(3001|3306|6379)'
```

## ⚙️ Configuração Inicial

### 1. Clonar o Repositório
```bash
git clone <repository-url> mymoney
cd mymoney
```

### 2. Configurar Variáveis de Ambiente

#### Copiar arquivo de exemplo
```bash
cp .env.example .env
```

#### Configurar .env para Produção
```env
# ===========================================
# CONFIGURAÇÃO DE PRODUÇÃO - MYMONEY
# ===========================================

# Ambiente
NODE_ENV=production
APP_PORT=3001
APP_HOST=0.0.0.0

# Base de Dados MariaDB
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=mymoney_prod
DB_USER=mymoney_user
DB_PASSWORD=${DB_PASSWORD}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}

# Configurações de Pool de Conexões
DB_CONNECTION_LIMIT=20
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# Redis Cache
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_DB=0

# Segurança JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Configurações de Sessão
SESSION_SECRET=${SESSION_SECRET}
SESSION_MAX_AGE=86400000

# Configurações de Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Configurações de Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads

# Configurações de Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=${SMTP_PASSWORD}
EMAIL_FROM=noreply@mymoney.com

# Configurações de Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/app/backups

# Configurações de Logs
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d

# Configurações de Monitoramento
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true

# Timezone
TZ=Europe/Lisbon
```

### 3. Configurar Permissões
```bash
# Criar diretórios necessários
mkdir -p data/mariadb data/redis data/uploads data/backups logs

# Configurar permissões
chmod 755 data/
chmod 700 data/mariadb data/redis
chmod 755 data/uploads data/backups logs

# Configurar ownership (Linux)
sudo chown -R 1000:1000 data/ logs/
```

## 🚀 Deploy com Docker Compose

### 1. Verificar Configuração
```bash
# Validar docker-compose.yml
docker compose config

# Verificar variáveis de ambiente
docker compose config --services
```

### 2. Iniciar Serviços
```bash
# Iniciar em modo detached
docker compose up -d

# Verificar status dos containers
docker compose ps

# Verificar logs
docker compose logs -f
```

### 3. Verificar Deploy
```bash
# Verificar saúde da aplicação
curl http://localhost:3001/health

# Verificar API
curl http://localhost:3001/api/health/detailed

# Verificar base de dados
docker compose exec mariadb mysql -u root -p -e "SHOW DATABASES;"
```

### 4. Comandos Úteis
```bash
# Parar serviços
docker compose down

# Reiniciar serviços
docker compose restart

# Ver logs específicos
docker compose logs -f mymoney-app
docker compose logs -f mariadb
docker compose logs -f redis

# Executar comandos no container
docker compose exec mymoney-app bash
docker compose exec mariadb mysql -u root -p

# Atualizar aplicação
docker compose pull
docker compose up -d --force-recreate
```

## 📱 Deploy em Unraid

### 1. Configuração via Docker Compose (Recomendado)

#### Docker Compose para Unraid com Auto-Update
Esta configuração permite atualizações automáticas via "Update Stack" no Compose Manager, puxando sempre a versão mais recente do GitHub.

```yaml
services: 
  app: 
    build: 
      context: https://github.com/PL7092/mymoney.git  
      dockerfile: Dockerfile 
    container_name: MyMoney 
    restart: unless-stopped 
    ports: 
      - "3001:3001" 
    volumes: 
      - /mnt/user/appdata/mymoney/uploads:/app/uploads 
      - /mnt/user/appdata/mymoney/config:/app/config 
    environment: 
      NODE_ENV: production 
      DB_HOST: 192.168.1.243  # IP do seu host MariaDB 
      DB_PORT: 3306 
      DB_NAME: mymoney 
      DB_USER: MyMoney 
      DB_PASSWORD: ${DB_PASSWORD} 
      DB_SSL: false 
      UPLOAD_DIR: /app/uploads
```

### Exemplo de Configuração Completa

```bash
# Configure as variáveis de ambiente no seu .env:
# - DB_PASSWORD: Senha do usuário da base de dados
# - DB_ROOT_PASSWORD: Senha do root do MariaDB
# - JWT_SECRET: Chave secreta para tokens JWT (mínimo 32 caracteres)
# - SESSION_SECRET: Chave secreta para sessões (mínimo 32 caracteres)
# - REDIS_PASSWORD: Senha do Redis (opcional)
# - SMTP_PASSWORD: Senha do email SMTP (se usar notificações)

# Volumes: /mnt/user/appdata/mymoney/
# Port: 3001:3001
```

#### Instruções de Instalação no Unraid

**Pré-requisitos:**
- Unraid 6.9+ com plugin "Compose Manager" instalado
- Container MariaDB já configurado e funcionando
- Acesso à rede onde está o MariaDB

**Passo 1: Instalar Compose Manager**
1. Aceda a **Community Applications**
2. Procure por **"Compose Manager"**
3. Instale o plugin e reinicie se necessário

**Passo 2: Criar Stack no Compose Manager**
1. Aceda ao **Compose Manager** no menu do Unraid
2. Clique em **"Add New Stack"**
3. Nome da Stack: **`mymoney`**
4. Cole a configuração docker-compose.yml acima
5. **IMPORTANTE**: Substitua `192.168.1.243` pelo IP real do seu MariaDB
6. Ajuste as credenciais da base de dados conforme sua configuração
7. Clique em **"Compose Up"**

**Passo 3: Verificar Funcionamento**
1. Aguarde o download e build (primeira execução: 5-10 minutos)
2. Aceda à aplicação em `http://[IP_DO_UNRAID]:3001`
3. Verifique os logs no Compose Manager se houver problemas

#### Como Fazer Updates

**Método 1: Update Stack (Recomendado)**
1. No Compose Manager, encontre a stack **"mymoney"**
2. Clique em **"Update Stack"**
3. O sistema irá:
   - Parar o container atual
   - Fazer pull do código mais recente do GitHub
   - Rebuild da imagem com as últimas alterações
   - Reiniciar o container
   - Limpar automaticamente as imagens antigas

**Método 2: Update Manual**
 ```bash
 # Via terminal do Unraid
 cd /boot/config/plugins/compose.manager/projects/mymoney
 docker compose pull
 docker compose up -d --build --force-recreate
 docker image prune -f  # Limpa imagens antigas
 ```

#### Limpeza de Cache Pós-Update

Após cada update, é recomendado limpar o cache para garantir que as alterações sejam aplicadas corretamente:

**Limpeza Automática (incluída no Update Stack):**
O processo de "Update Stack" já inclui limpeza automática, mas você pode forçar uma limpeza mais profunda:

```bash
# Limpeza completa de cache Docker
docker system prune -af --volumes

# Limpeza específica do projeto
docker compose down
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
docker volume prune -f
docker compose up -d --build --force-recreate

# Verificar se a aplicação está funcionando
curl -f http://[IP_DO_UNRAID]:3001/health || echo "Aplicação ainda não está pronta"
```

**Limpeza de Cache da Aplicação:**
```bash
# Limpar cache interno da aplicação (se necessário)
docker compose exec MyMoney rm -rf /tmp/* 2>/dev/null || true
docker compose restart MyMoney
```

**Script de Update Completo com Limpeza:**
```bash
#!/bin/bash
# update-mymoney-complete.sh

echo "🔄 Iniciando update completo do MyMoney..."

# Parar aplicação
docker compose down

# Limpeza de imagens antigas
echo "🧹 Limpando cache..."
docker image prune -f
docker builder prune -f

# Rebuild completo
echo "🔨 Fazendo rebuild..."
docker compose build --no-cache --pull

# Iniciar aplicação
echo "🚀 Iniciando aplicação..."
docker compose up -d

# Aguardar e verificar saúde
echo "⏳ Aguardando aplicação ficar pronta..."
sleep 30

# Verificar se está funcionando
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Update concluído com sucesso!"
else
    echo "❌ Erro no update. Verificar logs:"
    docker compose logs --tail=20 MyMoney
fi
```

### 6. Troubleshooting Unraid

**Problemas Comuns e Soluções:**

1. **Erro "Update Stack" não funciona:**
   ```bash
   # Verificar se o Compose Manager está atualizado
   # Ir para Apps > Compose Manager > Update
   
   # Verificar logs do container
   docker compose logs MyMoney
   ```

2. **Aplicação não inicia após update:**
   ```bash
   # Verificar se as portas estão livres
netstat -tulpn | grep :3001
   
   # Forçar recreação completa
   docker compose down
   docker compose up -d --force-recreate
   ```

3. **Problemas de permissão nos volumes:**
   ```bash
   # Ajustar permissões dos diretórios
   chmod -R 755 /mnt/user/appdata/mymoney/
   chown -R nobody:users /mnt/user/appdata/mymoney/
   ```

4. **Cache não limpa automaticamente:**
   ```bash
   # Limpeza manual forçada
   docker system prune -af
   docker builder prune -af
   ```

5. **Erro de conexão com MariaDB:**
   ```bash
   # Verificar se o MariaDB está rodando
   docker ps | grep mariadb
   
   # Testar conexão
   telnet 192.168.1.243 3306
   ```

**Logs Úteis:**
 ```bash
 # Logs da aplicação
 docker compose logs -f MyMoney

# Logs do sistema Unraid
tail -f /var/log/syslog

# Status dos containers
docker compose ps
```

#### Configuração Avançada para Produção

Para um ambiente de produção mais robusto, use esta configuração expandida:

```yaml
services: 
  app: 
    build: 
      context: https://github.com/PL7092/mymoney.git  
      dockerfile: Dockerfile 
    container_name: personal-finance-app 
    restart: unless-stopped 
    ports: 
      - "3000:3000" 
    volumes: 
      - /mnt/user/appdata/mymoney/uploads:/app/uploads 
      - /mnt/user/appdata/mymoney/config:/app/config
      - /mnt/user/appdata/mymoney/logs:/app/logs
      - /mnt/user/appdata/mymoney/backups:/app/backups
    environment: 
      NODE_ENV: production 
      DB_HOST: 192.168.1.243  # IP do seu host MariaDB 
      DB_PORT: 3306 
      DB_NAME: mymoney 
      DB_USER: MyMoney 
      DB_PASSWORD: ${DB_PASSWORD} 
      DB_SSL: false 
      UPLOAD_DIR: /app/uploads
      # Configurações de Performance
      NODE_OPTIONS: --max-old-space-size=512
      # Configurações de Segurança
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: 24h
      # Configurações de Logs
      LOG_LEVEL: info
      LOG_DIR: /app/logs
      # Configurações de Backup
      BACKUP_DIR: /app/backups
      BACKUP_RETENTION_DAYS: 30
      # Rate Limiting
      RATE_LIMIT_WINDOW_MS: 900000
      RATE_LIMIT_MAX_REQUESTS: 100
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### 2. Configuração via Template (Alternativa)

#### Criar Template Personalizado
```xml
<?xml version="1.0"?>
<Container version="2">
  <Name>MyMoney</Name>
  <Repository>mymoney:latest</Repository>
  <Registry>https://hub.docker.com/</Registry>
  <Network>bridge</Network>
  <MyIP/>
  <Shell>bash</Shell>
  <Privileged>false</Privileged>
  <Support>https://github.com/PL7092/mymoney</Support>
  <Project>https://github.com/PL7092/mymoney</Project>
  <Overview>Personal Finance Manager - Gestão financeira pessoal completa</Overview>
  <Category>Productivity:</Category>
  <WebUI>http://[IP]:[PORT:3001]</WebUI>
  <TemplateURL/>
  <Icon>https://raw.githubusercontent.com/PL7092/mymoney/main/public/favicon.ico</Icon>
  <ExtraParams/>
  <PostArgs/>
  <CPUset/>
  <DateInstalled>1640995200</DateInstalled>
  <DonateText/>
  <DonateLink/>
  <Description>
    Personal Finance Manager - Uma aplicação completa de gestão financeira pessoal.
    
    Funcionalidades:
    - Dashboard financeiro
    - Gestão de transações
    - Orçamentos e poupanças
    - Relatórios avançados
    - IA para análise financeira
  </Description>
  <Networking>
    <Mode>bridge</Mode>
    <Publish>
      <Port>
        <HostPort>3001</HostPort>
        <ContainerPort>3001</ContainerPort>
        <Protocol>tcp</Protocol>
      </Port>
    </Publish>
  </Networking>
  <Data>
    <Volume>
      <HostDir>/mnt/user/appdata/mymoney/uploads</HostDir>
      <ContainerDir>/app/uploads</ContainerDir>
      <Mode>rw</Mode>
    </Volume>
    <Volume>
      <HostDir>/mnt/user/appdata/mymoney/config</HostDir>
      <ContainerDir>/app/config</ContainerDir>
      <Mode>rw</Mode>
    </Volume>
    <Volume>
      <HostDir>/mnt/user/appdata/mymoney/logs</HostDir>
      <ContainerDir>/app/logs</ContainerDir>
      <Mode>rw</Mode>
    </Volume>
    <Volume>
      <HostDir>/mnt/user/appdata/mymoney/backups</HostDir>
      <ContainerDir>/app/backups</ContainerDir>
      <Mode>rw</Mode>
    </Volume>
  </Data>
  <Environment>
    <Variable>
      <Value>production</Value>
      <Name>NODE_ENV</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>192.168.1.243</Value>
      <Name>DB_HOST</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>mymoney</Value>
      <Name>DB_NAME</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>MyMoney</Value>
      <Name>DB_USER</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>${DB_PASSWORD}</Value>
      <Name>DB_PASSWORD</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>false</Value>
      <Name>DB_SSL</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>/app/uploads</Value>
      <Name>UPLOAD_DIR</Name>
      <Mode/>
    </Variable>
    <Variable>
      <Value>Europe/Lisbon</Value>
      <Name>TZ</Name>
      <Mode/>
    </Variable>
  </Environment>
  <Labels/>
  <Config Name="WebUI Port" Target="3001" Default="3001" Mode="tcp" Description="Port for web interface" Type="Port" Display="always" Required="true" Mask="false">3001</Config>
  <Config Name="Data Directory" Target="/app/data" Default="/mnt/user/appdata/mymoney/data" Mode="rw" Description="Application data directory" Type="Path" Display="always" Required="true" Mask="false">/mnt/user/appdata/mymoney/data</Config>
  <Config Name="Database Host" Target="DB_HOST" Default="mariadb" Mode="" Description="MariaDB hostname" Type="Variable" Display="always" Required="true" Mask="false">mariadb</Config>
  <Config Name="Database Password" Target="DB_PASSWORD" Default="" Mode="" Description="Database password" Type="Variable" Display="always" Required="true" Mask="true"></Config>
  <Config Name="JWT Secret" Target="JWT_SECRET" Default="" Mode="" Description="JWT secret key" Type="Variable" Display="always" Required="true" Mask="true"></Config>
</Container>
```

### 2. Configuração Manual no Unraid

#### Passo 1: Instalar MariaDB
```bash
# Via Community Applications
# Procurar por "MariaDB" e instalar
# Configurar:
# - Root Password: RootPasswordSegura456!
# - Database: mymoney_prod
# - User: mymoney_user
# - Password: SuaSenhaSegura123!
```

#### Passo 2: Instalar Redis
```bash
# Via Community Applications
# Procurar por "Redis" e instalar
# Configurar password se necessário
```

#### Passo 3: Instalar MyMoney
```bash
# Configurar container manualmente:
# Repository: mymoney:latest
# Network Type: Bridge
# Port: 3000:3000
# Volumes: conforme template acima
# Variables: conforme template acima
```

## 🔒 Configuração de Produção

### 1. Proxy Reverso (Nginx)

#### nginx.conf
```nginx
upstream mymoney_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name mymoney.seudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mymoney.seudominio.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/mymoney.crt;
    ssl_certificate_key /etc/ssl/private/mymoney.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    location / {
        proxy_pass http://mymoney_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://mymoney_backend;
        # ... outros headers proxy
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://mymoney_backend;
        # ... outros headers proxy
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://mymoney_backend;
    }
}
```

### 2. Firewall e Segurança

#### UFW (Ubuntu)
```bash
# Configurar firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verificar status
sudo ufw status verbose
```

#### Fail2Ban
```bash
# Instalar fail2ban
sudo apt install fail2ban

# Configurar jail local
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
```

### 3. SSL/TLS com Let's Encrypt

#### Certbot
```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d mymoney.seudominio.com

# Renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoramento e Logs

### 1. Configuração de Logs

#### Docker Compose Logging
```yaml
services:
  mymoney-app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Logrotate
```bash
# Configurar logrotate
sudo nano /etc/logrotate.d/mymoney
```

```
/var/log/mymoney/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 mymoney mymoney
    postrotate
        docker compose -f /path/to/docker-compose.yml restart mymoney-app
    endscript
}
```

### 2. Monitoramento com Prometheus

#### prometheus.yml
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mymoney'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 3. Health Checks

#### Script de Monitoramento
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3001/health"
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response != "200" ]; then
    message="🚨 MyMoney Health Check Failed - HTTP $response"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$message\"}" \
         $WEBHOOK_URL
    
    # Restart container if needed
    docker compose restart mymoney-app
fi
```

## 💾 Backup e Manutenção

### 1. Backup Automático

#### Script de Backup
```bash
#!/bin/bash
# backup-mymoney.sh

BACKUP_DIR="/backups/mymoney"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="mymoney-mariadb-1"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup da base de dados
docker exec $CONTAINER_NAME mysqldump -u root -p$DB_ROOT_PASSWORD \
    --single-transaction --routines --triggers mymoney_prod \
    > $BACKUP_DIR/mymoney_db_$DATE.sql

# Backup dos uploads
tar -czf $BACKUP_DIR/mymoney_uploads_$DATE.tar.gz data/uploads/

# Backup das configurações
cp .env $BACKUP_DIR/env_$DATE.backup
cp docker-compose.yml $BACKUP_DIR/docker-compose_$DATE.yml

# Limpeza de backups antigos (manter 30 dias)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
```

#### Crontab para Backup Automático
```bash
# Editar crontab
crontab -e

# Backup diário às 2:00 AM
0 2 * * * /path/to/backup-mymoney.sh >> /var/log/mymoney-backup.log 2>&1
```

### 2. Restauração de Backup

#### Script de Restauração
```bash
#!/bin/bash
# restore-mymoney.sh

BACKUP_FILE=$1
CONTAINER_NAME="mymoney-mariadb-1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql>"
    exit 1
fi

# Parar aplicação
docker compose stop mymoney-app

# Restaurar base de dados
docker exec -i $CONTAINER_NAME mysql -u root -p$DB_ROOT_PASSWORD \
    mymoney_prod < $BACKUP_FILE

# Reiniciar aplicação
docker compose start mymoney-app

echo "Restore completed from: $BACKUP_FILE"
```

### 3. Manutenção Regular

#### Script de Manutenção
```bash
#!/bin/bash
# maintenance-mymoney.sh

echo "Starting MyMoney maintenance..."

# Limpeza de logs antigos
docker system prune -f
docker volume prune -f

# Otimização da base de dados
docker exec mymoney-mariadb-1 mysql -u root -p$DB_ROOT_PASSWORD \
    -e "OPTIMIZE TABLE mymoney_prod.transactions, mymoney_prod.accounts, mymoney_prod.budgets;"

# Verificação de integridade
docker exec mymoney-mariadb-1 mysql -u root -p$DB_ROOT_PASSWORD \
    -e "CHECK TABLE mymoney_prod.transactions, mymoney_prod.accounts;"

# Atualização de estatísticas
docker exec mymoney-mariadb-1 mysql -u root -p$DB_ROOT_PASSWORD \
    -e "ANALYZE TABLE mymoney_prod.transactions, mymoney_prod.accounts;"

echo "Maintenance completed"
```

## 🔧 Solução de Problemas

### 1. Problemas Comuns

#### Container não inicia
```bash
# Verificar logs
docker compose logs mymoney-app

# Verificar configuração
docker compose config

# Verificar recursos
docker system df
free -h
```

#### Erro de conexão com base de dados
```bash
# Verificar status do MariaDB
docker compose ps mariadb

# Testar conexão
docker compose exec mariadb mysql -u root -p -e "SELECT 1;"

# Verificar logs do MariaDB
docker compose logs mariadb
```

#### Problemas de performance
```bash
# Verificar uso de recursos
docker stats

# Verificar logs de performance
docker compose logs mymoney-app | grep -i "slow\|timeout\|error"

# Verificar conexões de base de dados
docker compose exec mariadb mysql -u root -p \
    -e "SHOW PROCESSLIST; SHOW STATUS LIKE 'Threads_connected';"
```

### 2. Debug e Diagnóstico

#### Modo Debug
```bash
# Ativar logs detalhados
export LOG_LEVEL=debug
docker compose up -d

# Verificar logs em tempo real
docker compose logs -f --tail=100 mymoney-app
```

#### Verificação de Saúde
```bash
# Health check manual
curl -v http://localhost:3001/health

# Verificação detalhada
curl -s http://localhost:3001/api/health/detailed | jq .

# Verificar métricas
curl -s http://localhost:3001/metrics
```

## 🚀 Performance e Otimização

### 1. Otimização de Containers

#### docker-compose.override.yml para Produção
```yaml
version: '3.8'

services:
  mymoney-app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
    
  mariadb:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
    command: >
      --innodb-buffer-pool-size=512M
      --innodb-log-file-size=128M
      --max-connections=200
      --query-cache-size=64M
      --query-cache-type=1
    
  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M
    command: >
      redis-server
      --maxmemory 128mb
      --maxmemory-policy allkeys-lru
```

### 2. Configuração de Cache

#### Redis Otimizado
```bash
# Configuração Redis para produção
echo "
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
" > redis.conf
```

### 3. Monitoramento de Performance

#### Script de Monitoramento
```bash
#!/bin/bash
# monitor-performance.sh

echo "=== MyMoney Performance Monitor ==="
echo "Date: $(date)"
echo

echo "=== Container Stats ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo

echo "=== Database Performance ==="
docker compose exec mariadb mysql -u root -p$DB_ROOT_PASSWORD -e "
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Queries';
SHOW STATUS LIKE 'Slow_queries';
SHOW STATUS LIKE 'Innodb_buffer_pool_read_requests';
"
echo

echo "=== Application Health ==="
curl -s http://localhost:3001/api/health/detailed | jq '.database.responseTime, .redis.responseTime, .system.memory, .system.cpu'
```

## 📚 Recursos Adicionais

### 1. Scripts Úteis

#### Atualização Automática
```bash
#!/bin/bash
# update-mymoney.sh

echo "Updating MyMoney..."

# Backup antes da atualização
./backup-mymoney.sh

# Pull nova imagem
docker compose pull

# Atualizar containers
docker compose up -d --force-recreate

# Verificar saúde
sleep 30
curl -f http://localhost:3001/health || {
    echo "Health check failed, rolling back..."
    docker compose down
    # Restaurar backup se necessário
    exit 1
}

echo "Update completed successfully"
```

### 2. Documentação de API

A aplicação expõe os seguintes endpoints para monitoramento:

- `GET /health` - Health check básico
- `GET /api/health/detailed` - Health check detalhado
- `GET /metrics` - Métricas Prometheus
- `GET /api/database/status` - Status da base de dados

### 3. Suporte e Comunidade

- **Documentação**: [Link para documentação]
- **Issues**: [Link para issues no GitHub]
- **Discussões**: [Link para discussões]
- **Wiki**: [Link para wiki]

---

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o deploy:

1. Verifique os logs: `docker compose logs -f`
2. Execute o health check: `curl http://localhost:3001/health`
3. Consulte a seção de solução de problemas
4. Abra uma issue no GitHub com logs detalhados

---

**Nota**: Este guia assume conhecimento básico de Docker e administração de sistemas. Para ambientes de produção críticos, recomenda-se consultoria especializada em DevOps.

**Última atualização**: $(Get-Date -Format "yyyy-MM-dd")  
**Versão do guia**: 1.0.0