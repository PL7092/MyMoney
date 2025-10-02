# MyMoney - Guia de Inicialização

Este guia irá ajudá-lo a configurar e executar a aplicação MyMoney em seu sistema.

## Pré-requisitos

### 1. Node.js (Versão 14 ou superior)
- Baixe e instale o Node.js de: https://nodejs.org/
- Verifique a instalação executando: `node --version`
- Verifique o npm executando: `npm --version`

### 2. Banco de Dados (Opcional para teste)
- **MariaDB/MySQL** (recomendado para produção)
- **SQLite** (fallback automático para desenvolvimento)

## Passos de Instalação

### 1. Verificar Estrutura do Projeto
Certifique-se de que você tem todos os arquivos necessários:
```
✅ package.json
✅ server/server.js
✅ server/app.js
✅ server/services/ (todos os serviços)
✅ .env.example
```

### 2. Instalar Dependências
Execute no terminal (na pasta do projeto):
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edite o arquivo `.env` com suas configurações:
   ```env
   # Configuração do Banco de Dados
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=mymoney
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   
   # Configuração da Aplicação
   APP_PORT=3000
   JWT_SECRET=sua_chave_secreta_muito_segura
   
   # Ambiente
   NODE_ENV=development
   ```

### 4. Scripts de Verificação Disponíveis

#### Verificação Completa da Aplicação
```bash
node check-app.js
```

#### Verificação de Serviços
```bash
node test-simple.js
```

#### Verificação de Saúde do Sistema
```bash
npm run health
```

#### Status do Banco de Dados
```bash
npm run db:status
```

## Executando a Aplicação

### Modo Desenvolvimento
```bash
npm run server:dev
```

### Modo Produção
```bash
npm run server:prod
```

### Usando o script start
```bash
npm start
```

## Verificação de Funcionamento

### 1. Verificar se o servidor está rodando
Após iniciar o servidor, você deve ver mensagens como:
```
[INFO] Starting MyMoney server...
[INFO] Database initialized successfully
[INFO] Health checks started
[SUCCESS] Server running on port 3000
```

### 2. Testar Endpoints da API

#### Verificação de Saúde
```bash
curl http://localhost:3000/health
```

#### Verificação Detalhada
```bash
curl http://localhost:3000/api/health/detailed
```

#### Status do Banco de Dados
```bash
curl http://localhost:3000/api/database/status
```

### 3. Acessar a Interface Web
Abra seu navegador e acesse: `http://localhost:3000`

## Recursos Implementados

### 🔐 Autenticação e Segurança
- JWT Authentication
- Bcrypt para senhas
- Rate limiting
- Helmet para segurança HTTP
- CORS configurado

### 💾 Cache e Performance
- Redis cache (com fallback para memória)
- Compressão de respostas
- Cache automático de consultas

### 📊 Monitoramento e Logs
- Sistema de logs com Winston
- Health checks automáticos
- Monitoramento de recursos do sistema

### 🗄️ Banco de Dados
- Inicialização automática do banco
- Criação automática de tabelas
- Migrations automáticas
- Suporte a MariaDB/MySQL

### 🔄 Backup e Manutenção
- Backup automático configurável
- Limpeza automática de logs antigos
- Monitoramento de espaço em disco

## Solução de Problemas

### Erro: "node não é reconhecido"
- Reinstale o Node.js
- Adicione o Node.js ao PATH do sistema
- Reinicie o terminal/prompt de comando

### Erro: "Cannot find module"
- Execute: `npm install`
- Verifique se o arquivo `package.json` existe
- Verifique se você está na pasta correta

### Erro de Conexão com Banco de Dados
- Verifique as configurações no arquivo `.env`
- Certifique-se de que o MariaDB/MySQL está rodando
- A aplicação usará fallback para SQLite se necessário

### Porta 3000 já está em uso
- Altere a porta no arquivo `.env`: `APP_PORT=3001`
- Ou pare o serviço que está usando a porta 3000

### Erro de Permissões
- Execute o terminal como administrador (Windows)
- Verifique permissões de escrita na pasta do projeto

## Scripts Úteis

| Script | Comando | Descrição |
|--------|---------|-----------|
| Desenvolvimento | `npm run server:dev` | Inicia em modo desenvolvimento |
| Produção | `npm run server:prod` | Inicia em modo produção |
| Teste | `npm test` | Executa testes da aplicação |
| Saúde | `npm run health` | Verifica saúde do sistema |
| DB Status | `npm run db:status` | Status do banco de dados |
| Setup | `npm run setup` | Instalação automática |

## Estrutura de Pastas

```
MyMoney/
├── server/                 # Backend da aplicação
│   ├── services/          # Serviços (Cache, DB, Health, etc.)
│   ├── middleware/        # Middlewares de segurança
│   ├── routes/           # Rotas da API
│   ├── app.js            # Configuração do Express
│   └── server.js         # Ponto de entrada do servidor
├── src/                   # Frontend React
├── public/               # Arquivos estáticos
├── sql/                  # Scripts SQL
├── .env                  # Configurações (criar a partir do .env.example)
├── package.json          # Dependências e scripts
└── README.md            # Documentação
```

## Suporte

Se você encontrar problemas:

1. Verifique os logs no console
2. Execute `npm run health` para diagnóstico
3. Verifique se todas as dependências estão instaladas
4. Confirme se o arquivo `.env` está configurado corretamente

## Próximos Passos

Após a aplicação estar rodando:

1. **Configure o banco de dados** com suas credenciais reais
2. **Customize as configurações** no arquivo `.env`
3. **Acesse a interface web** em `http://localhost:3000`
4. **Crie sua primeira conta** de usuário
5. **Explore as funcionalidades** de gestão financeira

---

**Nota**: Esta aplicação foi desenvolvida para ser auto-suficiente e funcionar mesmo sem Docker ou configurações complexas. Todos os serviços têm fallbacks automáticos para garantir que a aplicação funcione em qualquer ambiente.