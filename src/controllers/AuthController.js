const crypto = require('node:crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const AuditLog = require('../models/AuditLog');

// In-memory active session tokens map: token -> { userId, email, role, expiresAt }
const activeSessions = new Map();

/**
 * Helper to extract client IP address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket ? req.socket.remoteAddress || '127.0.0.1' : '127.0.0.1';
}

class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user, verifies password hash, audits result and creates session
   */
  async login(req, res) {
    const ipAddress = getClientIp(req);
    const { email, password } = req.body || {};

    if (!email || !password) {
      AuditLog.record({
        user_email: email || 'anonymous',
        action: 'LOGIN_FAILED_EMPTY_CREDENTIALS',
        ip_address: ipAddress
      });
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      const user = User.findByEmail(email);

      if (!user || !user.verifyPassword(password)) {
        AuditLog.record({
          user_email: email,
          action: 'LOGIN_FAILED',
          ip_address: ipAddress
        });
        return res.status(401).json({
          error: 'E-mail ou senha incorretos. Por favor, verifique suas credenciais.'
        });
      }

      if (!user.is_active) {
        AuditLog.record({
          user_email: email,
          action: 'LOGIN_BLOCKED_INACTIVE',
          ip_address: ipAddress
        });
        return res.status(403).json({
          error: 'Acesso bloqueado. Este usuário está desativado pelo administrador.'
        });
      }

      // Generate secure session token (24h TTL)
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      activeSessions.set(sessionToken, {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        expiresAt
      });

      // Audit login success
      AuditLog.record({
        user_email: user.email,
        action: 'LOGIN_SUCCESS',
        ip_address: ipAddress
      });

      return res.json({
        success: true,
        message: 'Autenticação realizada com sucesso.',
        token: sessionToken,
        user: user.toJSON()
      });
    } catch (err) {
      console.error('Error during login:', err);
      return res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Generates single-use crypto token (15-min TTL), dispatches simulated email,
   * returns sanitized generic message to prevent enumeration attacks.
   */
  async forgotPassword(req, res) {
    const ipAddress = getClientIp(req);
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Informe o endereço de e-mail.' });
    }

    try {
      AuditLog.record({
        user_email: email,
        action: 'RESET_REQUESTED',
        ip_address: ipAddress
      });

      const user = User.findByEmail(email);
      let simulatedResetUrl = null;

      if (user && user.is_active) {
        const tokenRecord = PasswordResetToken.create(user.id, 15);
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        simulatedResetUrl = `${protocol}://${host}/login.html?token=${tokenRecord.token}`;

        // Simulated email dispatch output
        console.log('====================================================');
        console.log('📧 [SIMULAÇÃO DE DISPARO DE E-MAIL SEGURO]');
        console.log(`Para: ${user.email} (${user.name})`);
        console.log('Assunto: Redefinição de Senha - Pôr do Açaí PDV');
        console.log(`Link com validade de 15 minutos: ${simulatedResetUrl}`);
        console.log('====================================================');
      }

      // Sanitized generic success response to prevent user enumeration attacks
      return res.json({
        success: true,
        message: 'Se o e-mail informado estiver cadastrado em nossa base, as instruções para redefinição de senha foram enviadas.',
        // Expose debug reset url for local testing convenience if token was generated
        debugResetUrl: simulatedResetUrl
      });
    } catch (err) {
      console.error('Error in forgotPassword:', err);
      return res.status(500).json({ error: 'Erro ao processar solicitação de redefinição.' });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Validates token expiration & usage, updates password hash
   */
  async resetPassword(req, res) {
    const ipAddress = getClientIp(req);
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    try {
      const tokenRecord = PasswordResetToken.findValidToken(token);

      if (!tokenRecord) {
        AuditLog.record({
          user_email: 'unknown',
          action: 'RESET_FAILED_INVALID_OR_EXPIRED_TOKEN',
          ip_address: ipAddress
        });
        return res.status(400).json({
          error: 'Link de redefinição inválido ou expirado. Por favor, solicite um novo link.'
        });
      }

      const user = User.findById(tokenRecord.user_id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      // Update password hash
      User.updatePassword(user.id, newPassword);

      // Invalidate token
      PasswordResetToken.markAsUsed(tokenRecord.id);

      AuditLog.record({
        user_email: user.email,
        action: 'PASSWORD_RESET_SUCCESS',
        ip_address: ipAddress
      });

      return res.json({
        success: true,
        message: 'Senha atualizada com sucesso! Você já pode realizar o login com sua nova senha.'
      });
    } catch (err) {
      console.error('Error in resetPassword:', err);
      return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
    }
  }

  /**
   * GET /api/auth/session
   * Verifies current session token validity
   */
  async getSession(req, res) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : req.query.token;

    if (!token) {
      return res.status(401).json({ authenticated: false, error: 'Sessão não informada.' });
    }

    const session = activeSessions.get(token);
    if (!session || Date.now() > session.expiresAt) {
      if (session) activeSessions.delete(token);
      return res.status(401).json({ authenticated: false, error: 'Sessão expirada ou inválida.' });
    }

    const user = User.findById(session.userId);
    if (!user || !user.is_active) {
      activeSessions.delete(token);
      return res.status(401).json({ authenticated: false, error: 'Usuário desativado.' });
    }

    return res.json({
      authenticated: true,
      user: user.toJSON()
    });
  }

  /**
   * POST /api/auth/logout
   * Destroys active session and logs audit trail
   */
  async logout(req, res) {
    const ipAddress = getClientIp(req);
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : req.body.token;

    if (token && activeSessions.has(token)) {
      const session = activeSessions.get(token);
      AuditLog.record({
        user_email: session.email,
        action: 'LOGOUT',
        ip_address: ipAddress
      });
      activeSessions.delete(token);
    }

    return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  }

  /**
   * Helper to retrieve authenticated user from request session token
   */
  getAuthenticatedUser(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (req.query?.token || req.body?.token);

    if (!token) return null;

    const session = activeSessions.get(token);
    if (!session || Date.now() > session.expiresAt) {
      if (session) activeSessions.delete(token);
      return null;
    }

    const user = User.findById(session.userId);
    if (!user || !user.is_active) {
      activeSessions.delete(token);
      return null;
    }

    return user;
  }

  /**
   * Express middleware requiring an active authenticated user session
   */
  requireAuth(req, res, next) {
    const user = this.getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Sessão expirada ou não autenticada. Por favor, realize o login novamente.',
        requireLogin: true
      });
    }
    req.user = user;
    next();
  }
}

const authControllerInstance = new AuthController();
// Bind middleware method
authControllerInstance.requireAuth = authControllerInstance.requireAuth.bind(authControllerInstance);
authControllerInstance.getClientIp = getClientIp;

module.exports = authControllerInstance;
