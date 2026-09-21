import { createClient } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined;

export const isNeonConfigured = Boolean(authUrl && dataApiUrl);

export const neonClient = isNeonConfigured
  ? createClient({
      auth: { url: authUrl! },
      dataApi: { url: dataApiUrl! },
    })
  : null;
