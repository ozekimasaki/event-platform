import { Hono } from 'hono';
import { loginSchema, signupSchema, oauthCallbackSchema } from '@event-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient, type Env } from '../services/supabase.js';
import { requireAuth, getJwtFromContext } from '../services/auth.js';

// ============================================
// AUTH ROUTER
// ============================================

const auth = new Hono<{ Bindings: Env }>();

// ============================================
// POST /auth/signup
// ============================================

auth.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        400
      );
    }

    const { email, password, display_name } = parsed.data;
    const env = c.env;

    // Use admin client to create user (bypasses RLS)
    const admin = getAdminClient(env);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: display_name ? { display_name } : undefined,
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'SIGNUP_FAILED',
            message: error.message ?? 'Failed to create user',
          },
        },
        400
      );
    }

    // If display_name is provided, update the profile
    if (display_name && data.user) {
      await admin
        .from('profiles')
        .update({ display_name })
        .eq('user_id', data.user.id);
    }

    return c.json(
      {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at,
          },
        },
      },
      201
    );
  } catch (error) {
    console.error('Signup handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

// ============================================
// POST /auth/login
// ============================================

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        400
      );
    }

    const { email, password } = parsed.data;
    const env = c.env;

    const supabase = getSupabaseClient(env);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return c.json(
        {
          success: false,
          error: {
            code: 'LOGIN_FAILED',
            message: 'Invalid email or password',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        tokens: {
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
          expires_in: data.session!.expires_in,
          expires_at: data.session!.expires_at,
          token_type: 'bearer' as const,
        },
      },
    });
  } catch (error) {
    console.error('Login handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

// ============================================
// POST /auth/refresh
// ============================================

auth.post('/refresh', async (c) => {
  try {
    const body = await c.req.json<{ refresh_token: string }>();

    if (!body.refresh_token) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'refresh_token is required',
          },
        },
        400
      );
    }

    const env = c.env;
    const supabase = getSupabaseClient(env);
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token,
    });

    if (error) {
      return c.json(
        {
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: error.message ?? 'Failed to refresh token',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        tokens: {
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
          expires_in: data.session!.expires_in,
          expires_at: data.session!.expires_at,
          token_type: 'bearer' as const,
        },
      },
    });
  } catch (error) {
    console.error('Refresh handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

// ============================================
// GET /auth/me  (protected)
// ============================================

auth.get('/me', authMiddleware, async (c) => {
  try {
    const user = requireAuth(c);
    const env = c.env;

    // Fetch full profile from database
    const supabase = getSupabaseClient(env, getJwtFromContext(c));
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) {
      // Profile might not exist yet — return basic user info
      return c.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          display_name: user.email.split('@')[0],
          avatar_url: null,
          created_at: new Date().toISOString(),
        },
      });
    }

    return c.json({
      success: true,
      data: {
        id: profile.user_id,
        email: user.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
    });
  } catch (error) {
    console.error('Me handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

// ============================================
// POST /auth/oauth/google
// ============================================

auth.post('/oauth/google', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = oauthCallbackSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Authorization code is required',
          },
        },
        400
      );
    }

    const { code } = parsed.data;
    const env = c.env;

    // Exchange the authorization code for tokens via Supabase
    const supabase = getSupabaseClient(env);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Google OAuth error:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'OAUTH_FAILED',
            message: error.message ?? 'Failed to complete Google authentication',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        tokens: {
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
          expires_in: data.session!.expires_in,
          expires_at: data.session!.expires_at,
          token_type: 'bearer' as const,
        },
      },
    });
  } catch (error) {
    console.error('Google OAuth handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

// ============================================
// POST /auth/oauth/github
// ============================================

auth.post('/oauth/github', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = oauthCallbackSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Authorization code is required',
          },
        },
        400
      );
    }

    const { code } = parsed.data;
    const env = c.env;

    // Exchange the authorization code for tokens via Supabase
    const supabase = getSupabaseClient(env);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('GitHub OAuth error:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'OAUTH_FAILED',
            message: error.message ?? 'Failed to complete GitHub authentication',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        tokens: {
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
          expires_in: data.session!.expires_in,
          expires_at: data.session!.expires_at,
          token_type: 'bearer' as const,
        },
      },
    });
  } catch (error) {
    console.error('GitHub OAuth handler error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
});

export { auth };
