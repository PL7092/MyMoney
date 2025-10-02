# Instruções para Reconstruir Container MyMoney

## Problema Identificado
O container está a usar uma imagem em cache antiga que ainda contém configurações problemáticas.

## Solução: Limpeza Completa e Reconstrução

### 1. Parar e Remover Containers Existentes
```bash
# Parar todos os containers do projeto
docker-compose down

# Remover container específico se ainda existir
docker rm -f MyMoney

# Verificar se foi removido
docker ps -a | grep MyMoney
```

### 2. Limpar Imagens em Cache
```bash
# Remover imagem específica do projeto (se existir)
docker rmi mymoney_app

# Ou remover todas as imagens não utilizadas
docker image prune -a

# Para limpeza mais agressiva (CUIDADO: remove todas as imagens não utilizadas)
docker system prune -a --volumes
```

### 3. Reconstruir com Cache Limpo
```bash
# Reconstruir forçando sem cache
docker-compose build --no-cache

# Ou reconstruir e iniciar
docker-compose up --build --force-recreate
```

### 4. Verificar Build
```bash
# Verificar se a imagem foi criada corretamente
docker images | grep mymoney

# Verificar logs durante o build
docker-compose up --build
```

## Comandos Alternativos

### Opção 1: Rebuild Completo
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Opção 2: Force Recreate
```bash
docker-compose up --build --force-recreate --no-deps
```

### Opção 3: Limpeza Total
```bash
docker-compose down --volumes --remove-orphans
docker system prune -a
docker-compose up --build
```

## Verificação Final

Após reconstruir, verificar:
1. Container inicia sem erros de package.json
2. Logs mostram "node server/server.js" em vez de npm commands
3. Aplicação responde em http://localhost:3001

## Troubleshooting

Se o problema persistir:
1. Verificar se o Dockerfile está correto
2. Confirmar que não há volumes a sobrescrever /app
3. Verificar se external_links estão configurados corretamente
4. Confirmar que containers MariaDB e Redis externos existem