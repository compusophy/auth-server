import { Endpoints } from '@farcaster/quick-auth';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { z } from "zod/v4";
import { generateNonce, storeNonce } from './nonce';
import { verifyMessage } from './siwf';
import { createJWT, verifyJWT } from './jwt';

export const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 86400,
}));

app.get('/.well-known/jwks.json', async (c) => {
  try {
    const publicKey = JSON.parse(c.env.JWK_PUBLIC_KEY);

    return c.json({
      keys: [publicKey]
    });
  } catch (error) {
    console.error('Error retrieving public key:', error);
    return c.json({ error: 'Failed to retrieve public key' }, 500);
  }
});

// Minimal openid-configuration endpoint to allow services like jwt.io to discover the jwks endpoint
app.get('/.well-known/openid-configuration', async (c) => {
  return c.json(
    {
      "issuer": c.env.HOST,
      "jwks_uri": `${c.env.HOST}/.well-known/jwks.json`,
    }
  )
});

app.post('/nonce', async (c) => {
  try {
    const nonce = await generateNonce();
    c.executionCtx.waitUntil(storeNonce(c.env, nonce));
    return c.json({ nonce });
  } catch (error) {
    console.error('Error generating nonce:', error);
    return c.json({ error: 'Failed to generate nonce' }, 500);
  }
});

app.post('/verify-siwf',
  validator('json', (value, c) => {
    const parsed = Endpoints.VerifySiwf.requestBodySchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        error: 'invalid_params',
        error_message: z.prettifyError(parsed.error)
      }, 400);
    }

    return parsed.data;
  }),
  async (c) => {
    try {
      const { message, domain, signature, acceptAuthAddress } = c.req.valid('json');
      const verifyResult = await verifyMessage(c.env, { domain, message, signature, acceptAuthAddress });
      if (!verifyResult.isValid) {
        return c.json({ valid: false, message: verifyResult.message });
      }

      const token = await createJWT({
        env: c.env,
        fid: verifyResult.fid,
        address: verifyResult.address,
        domain
      });

      return c.json({ valid: true, token });
    } catch (error) {
      console.error('error verifying message');
      return c.json({ error: `failed to verify message: ${error}` }, 500);
    }
  });

app.get(
  '/verify-jwt',
  validator('query', (value, c) => {
    const parsed = Endpoints.VerifyJwt.requestQueryParametersSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        error: 'invalid_params',
        error_message: z.prettifyError(parsed.error)
      }, 400);
    }

    return parsed.data;
  }),
  async (c) => {
    try {
      const { token, domain } = c.req.valid('query');
      const payload = await verifyJWT({ env: c.env, token, domain });
      if (payload) {
        return c.json(payload);
      }

      return c.json({
        error: 'invalid_token',
        error_message: 'Token is not valid'
      }, 400);
    } catch (error) {
      console.error('Error verifying JWT:', error);
      return c.json({ error: 'Failed to verify JWT' }, 500);
    }
  });
