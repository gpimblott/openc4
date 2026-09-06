import type { Context, Next } from 'hono';
import type { AuthService } from './service.js';
import type { Actions, Subjects, User, AppAbility } from './types.js';
import { defineAbilityFor } from './ability.js';

// Extend Hono's Context Variables
declare module 'hono' {
  interface ContextVariableMap {
    user?: User;
    ability?: AppAbility;
  }
}

/**
 * Extracts bearer token or cookie and populates context with authenticated user & CASL ability.
 */
export function createAuthMiddleware(authService: AuthService, options?: { optional?: boolean }) {
  return async (c: Context, next: Next) => {
    let token: string | undefined;

    // 1. Authorization header: Bearer <token>
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2. Cookie fallback: openc4_token or auth_token
    if (!token) {
      const cookieHeader = c.req.header('Cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)(?:openc4_token|auth_token)=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

    // 3. Query parameter fallback: ?token=<token>
    if (!token) {
      token = c.req.query('token');
    }

    if (token) {
      const user = await authService.verifyToken(token);
      if (user) {
        c.set('user', user);
        c.set('ability', defineAbilityFor(user));
      }
    }

    // If route strictly requires authentication and no valid user was found
    if (!options?.optional && !c.get('user')) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    await next();
  };
}

/**
 * CASL Authorization Guard Middleware.
 * Enforces that the authenticated user possesses the CASL ability to perform `action` on `subject`.
 */
export function requireAbility(action: Actions, subject: Subjects) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    let ability = c.get('ability');

    if (!user || !ability) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required to access this resource'
        },
        401
      );
    }

    if (ability.cannot(action, subject)) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Your role (${user.role}) does not have permission to ${action} ${subject}`
        },
        403
      );
    }

    await next();
  };
}
