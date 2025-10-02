import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto-js';
import { DatabaseService } from '../db.js';

class AuthService {
  constructor() {
    this.db = new DatabaseService();
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureSecret();
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.generateSecureSecret();
    this.tokenExpiry = process.env.JWT_EXPIRY || '15m';
    this.refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  generateSecureSecret() {
    return crypto.lib.WordArray.random(256/8).toString();
  }

  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  generateTokens(userId, email) {
    const payload = { userId, email };
    
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
      issuer: 'mymoney-app',
      audience: 'mymoney-users'
    });

    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiry,
      issuer: 'mymoney-app',
      audience: 'mymoney-users'
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'mymoney-app',
        audience: 'mymoney-users'
      });
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'mymoney-app',
        audience: 'mymoney-users'
      });
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async register(email, password, name) {
    try {
      // Verificar se o usuário já existe
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser.length > 0) {
        throw new Error('User already exists');
      }

      // Hash da password
      const hashedPassword = await this.hashPassword(password);

      // Criar usuário
      const result = await this.db.query(
        'INSERT INTO users (email, password, name, created_at) VALUES (?, ?, ?, NOW())',
        [email, hashedPassword, name]
      );

      const userId = result.insertId;

      // Gerar tokens
      const tokens = this.generateTokens(userId, email);

      // Salvar refresh token na base de dados
      await this.saveRefreshToken(userId, tokens.refreshToken);

      return {
        user: { id: userId, email, name },
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  async login(email, password) {
    try {
      // Buscar usuário
      const users = await this.db.query(
        'SELECT id, email, password, name FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = users[0];

      // Verificar password
      const isValidPassword = await this.verifyPassword(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Gerar tokens
      const tokens = this.generateTokens(user.id, user.email);

      // Salvar refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      // Atualizar último login
      await this.db.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      return {
        user: { id: user.id, email: user.email, name: user.name },
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  async refreshTokens(refreshToken) {
    try {
      // Verificar refresh token
      const decoded = this.verifyRefreshToken(refreshToken);

      // Verificar se o token existe na base de dados
      const tokenRecord = await this.db.query(
        'SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
        [refreshToken]
      );

      if (tokenRecord.length === 0) {
        throw new Error('Invalid refresh token');
      }

      // Buscar dados do usuário
      const users = await this.db.query(
        'SELECT id, email, name FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length === 0) {
        throw new Error('User not found');
      }

      const user = users[0];

      // Gerar novos tokens
      const tokens = this.generateTokens(user.id, user.email);

      // Remover token antigo e salvar novo
      await this.revokeRefreshToken(refreshToken);
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        user: { id: user.id, email: user.email, name: user.name },
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  async saveRefreshToken(userId, token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await this.db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );
  }

  async revokeRefreshToken(token) {
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE token = ?',
      [token]
    );
  }

  async revokeAllUserTokens(userId) {
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [userId]
    );
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await this.revokeRefreshToken(refreshToken);
    }
  }

  // Middleware para verificar autenticação
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = this.verifyAccessToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // Cleanup de tokens expirados
  async cleanupExpiredTokens() {
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
  }
}

export { AuthService };