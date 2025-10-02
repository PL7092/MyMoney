# Personal Finance Manager - Unraid Docker Deployment

This is a complete personal finance management application ready for deployment on Unraid using Docker containers.

## Features

- **Complete Financial Management**: Transactions, budgets, accounts, investments, savings goals
- **Real MariaDB Database**: No more mock data - full database persistence
- **Unraid Ready**: Optimized Docker setup for Unraid deployment
- **Multi-container Setup**: Separate app and database containers for better resource management
- **Auto-initialization**: Database schema is created automatically on first run
- **Health Monitoring**: Built-in health checks for both containers

## Quick Deploy on Unraid

### Method 1: Docker Compose (Recommended)

1. **Copy project files** to your Unraid server (e.g., `/mnt/user/appdata/personal-finance/`)

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Edit configuration** in `.env` file:
   ```env
   # Database passwords (CHANGE THESE!)
   DB_PASSWORD=your_secure_password_here
   DB_ROOT_PASSWORD=your_root_password_here
   
   # JWT Secret (CHANGE THIS!)
   JWT_SECRET=your_very_long_random_jwt_secret_here
   
   # Ports (adjust if needed)
   APP_PORT=3000
   DB_PORT=3306
   ```

4. **Deploy using Docker Compose**:
   ```bash
   docker-compose up -d
   ```

5. **Access your app** at `http://your-unraid-ip:3000`

### Method 2: Unraid Template (Manual Setup)

#### Container 1: MariaDB Database

- **Repository**: `mariadb:11.2`
- **Network Type**: Custom (create network: `personal-finance-network`)
- **Ports**: `3306:3306` (optional, for external access)
- **Variables**:
  - `MYSQL_ROOT_PASSWORD`: `your_root_password`
  - `MYSQL_DATABASE`: `personal_finance`
  - `MYSQL_USER`: `finance_user`
  - `MYSQL_PASSWORD`: `your_secure_password`
- **Volumes**:
  - `/mnt/user/appdata/personal-finance/database`: `/var/lib/mysql`
  - `/mnt/user/appdata/personal-finance/sql/init.sql`: `/docker-entrypoint-initdb.d/init.sql:ro`

#### Container 2: Personal Finance App

- **Repository**: Build from source or use pre-built image
- **Network Type**: Custom (`personal-finance-network`)
- **Ports**: `3000:3000`
- **Variables**:
  - `NODE_ENV`: `production`
  - `DB_HOST`: `personal-finance-db` (container name)
  - `DB_PORT`: `3306`
  - `DB_NAME`: `personal_finance`
  - `DB_USER`: `finance_user`
  - `DB_PASSWORD`: `your_secure_password` (same as database)
  - `JWT_SECRET`: `your_jwt_secret`
- **Volumes**:
  - `/mnt/user/appdata/personal-finance/uploads`: `/app/uploads`

## Building the Application

If you need to build the Docker image locally:

```bash
# Clone or download the source code
cd personal-finance-manager

# Build the Docker image
docker build -t personal-finance-app .

# Or use docker-compose to build
docker-compose build
```

## Configuration Options

### Database Settings

- **Host**: Use container name (`mariadb`) for internal networking
- **Port**: 3306 (standard MariaDB port)
- **Database**: `personal_finance`
- **Credentials**: Set secure username/password in environment variables

### Security Considerations

1. **Change default passwords** in `.env` file
2. **Set strong JWT secret** (64+ character random string)
3. **Use internal networking** - don't expose database port externally unless needed
4. **Regular backups** - MariaDB data is persisted in Docker volume
5. **File uploads** are stored in mapped volume for persistence

### Data Persistence

- **Database**: Stored in Docker volume `mariadb_data` or mapped host directory
- **File Uploads**: Mapped to `/mnt/user/appdata/personal-finance/uploads`
- **Application Logs**: Available through Docker logs

### Backup Strategy

```bash
# Database backup
docker exec personal-finance-db mysqldump -u root -p personal_finance > backup.sql

# Full application data backup
tar -czf personal-finance-backup-$(date +%Y%m%d).tar.gz /mnt/user/appdata/personal-finance/
```

## Troubleshooting

### Container Won't Start

1. Check Docker logs: `docker logs personal-finance-app`
2. Verify environment variables are set correctly
3. Ensure database container is healthy before app starts

### Database Connection Issues

1. Check if MariaDB container is running: `docker ps`
2. Verify network connectivity: `docker exec personal-finance-app ping mariadb`
3. Check database credentials in environment variables

### First-Time Setup

1. The database schema is created automatically on first run
2. Default categories are inserted during initialization
3. Access the app and configure database settings in Settings > Database

### Performance Tuning

- Allocate sufficient RAM to MariaDB container (recommended: 512MB+)
- Use SSD storage for database volume if possible
- Monitor container resource usage in Unraid dashboard

## Ports Used

- **3000**: Web application (HTTP)
- **3306**: MariaDB database (optional external access)

## Support

For issues specific to Unraid deployment, check:
1. Unraid Docker container logs
2. Network configuration
3. Volume permissions
4. Resource allocation

The application includes built-in health checks and monitoring to help identify issues quickly.