// Constantes e helpers da cTrader Open API OAuth (fluxo de autorização).
// O redirect_uri precisa estar cadastrado no app em connect.spotware.com.

export const CTRADER_AUTH_URL = 'https://openapi.ctrader.com/apps/auth';
export const CTRADER_TOKEN_URL = 'https://openapi.ctrader.com/apps/token';

// Redirect URI registrado no app Open API (o mesmo usado na URL de autorização).
export const CTRADER_REDIRECT_URI = 'https://arb-trader-dashboard.vercel.app/';

export function buildCtraderAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CTRADER_REDIRECT_URI,
    scope: 'trading',
  });
  return `${CTRADER_AUTH_URL}?${params.toString()}`;
}
