# Personal Finance Manager

Uma aplicação web completa de gestão financeira pessoal desenvolvida com React, TypeScript e Tailwind CSS, pronta para ser executada em Docker/Unraid com base de dados MariaDB.

## 📋 Funcionalidades

### 💰 Gestão Financeira
- **Dashboard Principal**: Visão geral das finanças com estatísticas em tempo real
- **Transações**: Registo e gestão completa de receitas e despesas
- **Contas**: Gestão de múltiplas contas bancárias e cartões
- **Orçamentos**: Criação e monitorização de orçamentos por categoria
- **Poupanças**: Gestão de objetivos de poupança com metas inteligentes

### 📊 Análise e Relatórios
- **Relatórios Avançados**: Análise detalhada com gráficos interativos
- **Exportação**: Dados exportáveis em CSV, JSON e PDF
- **Análise Preditiva**: Previsões baseadas em IA dos padrões de gastos

### 🤖 Inteligência Artificial
- **Consultor IA**: Recomendações personalizadas de gestão financeira
- **Deteção de Padrões**: Análise automática de comportamentos de gasto
- **Alertas Inteligentes**: Notificações baseadas em regras personalizáveis

### 💼 Investimentos e Ativos
- **Carteira de Investimentos**: Gestão completa de investimentos
- **Gestão de Ativos**: Registo de bens com custos operacionais e documentos
- **Análise de Performance**: Acompanhamento de rentabilidade

### 🔄 Automação
- **Transações Recorrentes**: Automatização de pagamentos regulares
- **Regras de Categorização**: Classificação automática de transações
- **Poupança Automática**: Transfer automáticas para objetivos de poupança

### 📱 Interface e Usabilidade
- **Design Responsivo**: Otimizado para desktop, tablet e mobile
- **Tema Escuro/Claro**: Interface adaptável às preferências do utilizador
- **Notificações**: Centro de notificações em tempo real
- **Importação/Exportação**: Migração fácil de dados financeiros

### 🔐 Segurança e Dados
- **Autenticação Segura**: Sistema de login protegido
- **Backup Automático**: Cópias de segurança da base de dados
- **Gestão de Dados**: Ferramentas avançadas de administração de dados

## 🛠 Tecnologias Utilizadas

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Shadcn/UI
- **Base de Dados**: MariaDB
- **Gráficos**: Recharts
- **Roteamento**: React Router
- **Estado**: Context API, React Query
- **Formulários**: React Hook Form com validação Zod

## 🐳 Instalação no Unraid com Compose

### Pré-requisitos
- Unraid 6.8+ com Compose Manager plugin instalado
- Plugin "Compose Manager" disponível via Community Applications

### Instalação Automática via Unraid Compose

**Passo 1:** Instale o plugin Compose Manager
- Aceda a **Community Applications**
- Procure por "Compose Manager" 
- Instale o plugin e reinicie se necessário

**Passo 2:** Configure um Container MariaDB Existente (se não tiver)
Se ainda não tem um container MariaDB no Unraid, crie um primeiro:
1. Aceda ao **Docker** tab no Unraid
2. Clique em **Add Container**
3. Configure:
   - **Nome**: `mariadb-financeflow`
   - **Repository**: `mariadb:10.11`
   - **Network Type**: `bridge` ou `Custom: br0`
   - **Port Mappings**: `3306:3306`
   - **Variables**:
     - `MYSQL_ROOT_PASSWORD`: `sua_password_root_segura`
     - `MYSQL_DATABASE`: `personal_finance`
     - `MYSQL_USER`: `finance_user`
     - `MYSQL_PASSWORD`: `sua_password_user_segura`
   - **Volumes**: `/mnt/user/appdata/mariadb-financeflow:/var/lib/mysql`

**Passo 3:** Crie a stack do Personal Finance Manager
1. Aceda ao **Compose Manager** no menu do Unraid
2. Clique em **Add New Stack**
3. Nome da Stack: `personal-finance`
4. **IMPORTANTE**: Substitua `SEU_CONTAINER_MARIADB` pelo nome real do seu container MariaDB
5. Cole o seguinte docker-compose.yml:

```yaml
version: '3.8'

services:
  app:
    build:
      context: https://github.com/PL7092/financeflow-next-chapter.git
      dockerfile: Dockerfile
    image: personal-finance:latest
    container_name: personal-finance-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /mnt/user/appdata/personal-finance/uploads:/app/uploads
      - /mnt/user/appdata/personal-finance/config:/app/config
    environment:
      NODE_ENV: production
      # Estas configurações serão sobrescritas pelas definições na aplicação
      DB_HOST: SEU_CONTAINER_MARIADB  # SUBSTITUA pelo nome do seu container MariaDB
      DB_PORT: 3306
      DB_NAME: personal_finance
      DB_USER: finance_user
      DB_PASSWORD: sua_password_user_segura  # SUBSTITUA pela sua password
      DB_SSL: false
      UPLOAD_DIR: /app/uploads
    # Liga ao container MariaDB existente
    external_links:
      - SEU_CONTAINER_MARIADB:mariadb  # SUBSTITUA pelo nome do seu container MariaDB
```

**Passo 4:** Inicie a stack
1. **IMPORTANTE**: Certifique-se que o container MariaDB está a funcionar antes de continuar
2. Clique em **Compose Up** para criar e iniciar a aplicação
3. Aguarde o download das imagens e compilação (primeira execução pode demorar 5-10 minutos)
4. Aceda à aplicação em `http://[IP_DO_UNRAID]:3000`

### Configuração Pós-Instalação

Após a instalação bem-sucedida:
1. **Aceda à aplicação**: `http://[IP_DO_UNRAID]:3000`
2. **Configure a Base de Dados**:
   - Vá para **Configurações** > **Base de Dados**
   - **Servidor**: Nome ou IP do container MariaDB (ex: `mariadb-financeflow` ou IP do Unraid)
   - **Porto**: `3306`
   - **Nome da Base de Dados**: `personal_finance`
   - **Utilizador**: `finance_user` (ou conforme configurou no MariaDB)
   - **Palavra-passe**: A password configurada no container MariaDB
   - Clique **Testar Ligação** para verificar
   - Clique **Guardar** se o teste for bem-sucedido
3. **Crie a sua conta de administrador**
4. **Configure as suas contas financeiras**
5. **Importe dados existentes se necessário**

> **Nota**: As configurações da base de dados na aplicação têm precedência sobre as variáveis de ambiente do Docker.

### Gestão da Stack

**Para atualizar a aplicação:**
```bash
# No Compose Manager, selecione a stack "personal-finance"
# Clique em "Compose Down" depois "Compose Up"
# Ou use "Recreate" para forçar atualização
```

**Para ver logs:**
```bash
# No Compose Manager, clique em "Logs" na stack
# Ou via SSH no Unraid:
docker logs personal-finance-app
docker logs personal-finance-db
```

**Para backup dos dados:**
```bash
# Os dados ficam guardados em:
# /mnt/user/appdata/[SEU_CONTAINER_MARIADB] (base de dados - conforme configurado no seu MariaDB)
# /mnt/user/appdata/personal-finance/uploads (ficheiros enviados)
# /mnt/user/appdata/personal-finance/config (configurações da aplicação)
```

**Para alterar configurações da base de dados:**
- Use sempre a interface da aplicação: **Configurações** > **Base de Dados**
- As definições na aplicação sobrepõem-se às variáveis de ambiente
- Teste sempre a ligação antes de guardar as alterações

### 3. Configuração Inicial

1. Aceda à aplicação: `http://[IP_UNRAID]:3000`
2. Complete a configuração inicial da base de dados
3. Crie a sua conta de utilizador
4. Configure as suas contas e categorias

## 🔄 Atualização da Aplicação

### Como Funciona o Processo de Atualização

Quando são feitas alterações ao código no **GitHub**, é necessário atualizar a imagem Docker e reiniciar o container no Unraid para aplicar as mudanças. O processo segue estes passos:

1. **Código atualizado no GitHub** → 2. **Build nova imagem Docker** → 3. **Atualizar container no Unraid**

### Método 1: Via Unraid Interface (Recomendado)

**Passo a passo para atualizar após mudanças no GitHub:**

1. Aceda ao **Docker** tab no Unraid WebUI
2. Localize o container "personal-finance" 
3. Clique no ícone do container e selecione **Force Update**
4. Confirme a atualização - o sistema irá:
   - Parar o container atual
   - Descarregar a imagem mais recente do Docker Hub
   - Recriar o container com a nova versão
   - Manter todos os dados nos volumes persistentes

> **Nota**: Se não vir atualizações imediatamente, pode ser necessário aguardar que a nova imagem seja construída e publicada no Docker Hub (processo automático via GitHub Actions).

### Método 2: Via Linha de Comandos SSH

Conecte-se ao Unraid via SSH e execute:

```bash
# 1. Parar o container
docker stop personal-finance

# 2. Remover o container (dados permanecem seguros nos volumes)
docker rm personal-finance

# 3. Remover a imagem antiga (força download da nova versão)
docker rmi [seu-dockerhub-username]/personal-finance:latest

# 4. Descarregar a imagem mais recente do GitHub
docker pull [seu-dockerhub-username]/personal-finance:latest

# 5. Recriar o container com a nova imagem
docker run -d \
  --name=personal-finance \
  --net=bridge \
  -p 3000:80 \
  -v /mnt/user/appdata/personal-finance:/app \
  --restart unless-stopped \
  [seu-dockerhub-username]/personal-finance:latest
```

### Método 3: Atualização Automática com Watchtower

Instale o Watchtower para atualizações automáticas:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --schedule "0 2 * * *" \
  --cleanup \
  personal-finance
```

Isto irá verificar atualizações diariamente às 2:00 da manhã.

### Método 4: Webhook com GitHub Actions (Avançado)

Para atualizações instantâneas após commits no GitHub:

**1. No Unraid, instale o Webhook plugin:**
- Community Applications > Webhook
- Configure endpoint: `http://[IP_UNRAID]:9000/hooks/update-finance`

**2. Crie script de atualização (`/boot/config/scripts/update-finance.sh`):**
```bash
#!/bin/bash
docker stop personal-finance
docker rm personal-finance
docker rmi [seu-dockerhub-username]/personal-finance:latest
docker pull [seu-dockerhub-username]/personal-finance:latest
docker run -d \
  --name=personal-finance \
  --net=bridge \
  -p 3000:80 \
  -v /mnt/user/appdata/personal-finance:/app \
  --restart unless-stopped \
  [seu-dockerhub-username]/personal-finance:latest
```

**3. No GitHub, adicione webhook:**
- Settings > Webhooks > Add webhook
- URL: `http://[IP_UNRAID]:9000/hooks/update-finance`
- Content type: `application/json`
- Events: `Just the push event`

### Verificar se a Atualização foi Bem-sucedida

Após qualquer método de atualização:

1. Verifique se o container está a correr: **Docker tab > personal-finance > Status: Started**
2. Aceda à aplicação: `http://[IP_UNRAID]:3000`
3. Verifique a versão na página de configurações
4. Confirme que as novas funcionalidades estão disponíveis

### Resolução de Problemas de Atualização

Se a atualização falhar:

```bash
# Verificar logs do container
docker logs personal-finance

# Verificar se a imagem foi descarregada
docker images | grep personal-finance

# Reiniciar o container manualmente
docker restart personal-finance
```

## 🛠 Desenvolvimento Local

Para desenvolver localmente:

```bash
# Clonar o repositório
git clone [URL_DO_REPOSITORIO]
cd personal-finance-manager

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 📊 Estrutura da Base de Dados

A aplicação cria automaticamente as seguintes tabelas:
- `users` - Dados dos utilizadores
- `accounts` - Contas financeiras
- `transactions` - Transações
- `budgets` - Orçamentos
- `savings_goals` - Objetivos de poupança
- `investments` - Investimentos
- `assets` - Ativos e bens
- `categories` - Categorias personalizadas
- `recurring_transactions` - Transações recorrentes
- `notifications` - Centro de notificações

## 🔧 Configuração

A aplicação pode ser configurada através de:
- Interface web (Definições > Configurações)
- Variáveis de ambiente Docker
- Ficheiro de configuração JSON

## 📝 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

## 🤝 Contribuições

Contribuições são bem-vindas! Por favor:
1. Faça fork do projeto
2. Crie uma branch para a funcionalidade (`git checkout -b feature/nova-funcionalidade`)
3. Commit as alterações (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📞 Suporte

Para questões e suporte:
- Abra um issue no GitHub
- Consulte a documentação na aplicação
- Verifique os logs do container para diagnóstico

## 🚀 Roadmap

- [ ] Aplicação mobile nativa
- [ ] Integração com APIs bancárias
- [ ] Análise de mercado em tempo real
- [ ] Relatórios fiscais automáticos
- [ ] Suporte multi-idioma completo