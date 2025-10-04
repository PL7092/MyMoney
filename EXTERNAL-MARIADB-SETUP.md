# Configuração para usar Containers Externos (MariaDB + Redis)

## Passos para configurar o MyMoney com containers MariaDB e Redis existentes:

### 1. Identificar os Containers Existentes

#### MariaDB:
```bash
# Listar todos os containers MariaDB
docker ps -a --filter "ancestor=mariadb" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

#### Redis:
```bash
# Listar todos os containers Redis
docker ps -a --filter "ancestor=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

#### Todos os containers:
```bash
docker ps -a
```

### 2. Configurar o docker-compose.yml

No ficheiro `docker-compose.yml`, substitua pelos nomes reais dos seus containers:

```yaml
external_links:
  - "SEU_CONTAINER_MARIADB:mariadb"
  - "SEU_CONTAINER_REDIS:redis"
```

### 3. Configurar as Variáveis de Ambiente

No ficheiro `.env`, configure:

```env
# Host da base de dados (nome do container externo)
DB_HOST=SEU_CONTAINER_MARIADB
# Ou use o IP do container se necessário
# DB_HOST=172.17.0.2

# Porta da base de dados
DB_PORT=3306

# Credenciais da base de dados (devem coincidir com o container existente)
DB_NAME=mymoney
DB_USER=MyMoney
DB_PASSWORD=${DB_PASSWORD}  # Obter do secret ou variável de ambiente
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}  # Obter do secret ou variável de ambiente

# Redis Configuration
REDIS_HOST=redis  # Nome do serviço no external_links
REDIS_PORT=6379   # Porta interna do Redis
REDIS_URL=redis://redis:6379
```

### 4. Alternativas de Configuração

#### Opção A: Usar external_links (atual)
- Mantém o container MariaDB separado
- Usa `external_links` para conectar

#### Opção B: Usar rede externa
```yaml
networks:
  default:
    external: true
    name: nome_da_rede_do_mariadb
```

#### Opção C: Usar host networking
```yaml
network_mode: "host"
```

### 5. Verificar Conectividade

Antes de executar o docker-compose, teste a conectividade:

```bash
# Verificar se o container MariaDB está a correr
docker ps | grep mariadb

# Testar conexão à base de dados
docker exec -it SEU_CONTAINER_MARIADB mysql -u root -p
```

### 6. Executar o MyMoney

```bash
# Parar containers existentes
docker-compose down

# Iniciar apenas Redis e App (MariaDB é externo)
docker-compose up -d
```

### 7. Resolução de Problemas

#### Se não conseguir conectar:
1. Verificar se o container MariaDB está na mesma rede
2. Usar o IP do container em vez do nome
3. Verificar as credenciais da base de dados
4. Verificar se a base de dados `mymoney` existe

#### Obter IP do container MariaDB:
```bash
docker inspect SEU_CONTAINER_MARIADB | grep IPAddress
```

#### Criar a base de dados se não existir:
```sql
CREATE DATABASE IF NOT EXISTS mymoney;
CREATE USER IF NOT EXISTS 'MyMoney'@'%' IDENTIFIED BY 'SUA_SENHA_SEGURA_AQUI';
GRANT ALL PRIVILEGES ON mymoney.* TO 'MyMoney'@'%';
FLUSH PRIVILEGES;
```

### 8. Troubleshooting

#### Verificar se os containers estão a correr:
```bash
# MariaDB
docker ps | grep mariadb

# Redis
docker ps | grep redis
```

#### Testar conexões:

##### Base de dados:
```bash
# Entrar no container da aplicação
docker exec -it mymoney-app bash

# Testar conexão MariaDB
mysql -h mariadb -u mymoney -p
```

##### Redis:
```bash
# Entrar no container da aplicação
docker exec -it mymoney-app bash

# Testar conexão Redis
redis-cli -h redis ping
```

#### Verificar logs:
```bash
# Logs da aplicação
docker logs mymoney-app

# Logs dos containers externos (se necessário)
docker logs NOME_DO_SEU_CONTAINER_MARIADB
docker logs NOME_DO_SEU_CONTAINER_REDIS
```