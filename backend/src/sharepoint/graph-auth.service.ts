import { Injectable, Logger } from '@nestjs/common';
import { ConfidentialClientApplication } from '@azure/msal-node';

/**
 * Obtiene tokens de acceso para Microsoft Graph usando el flujo de
 * credenciales de cliente (aplicación, sin usuario interactivo) — el
 * adecuado para un backend que sincroniza documentos de forma automática.
 *
 * Requiere que un administrador de Azure AD haya:
 *  1. Registrado una aplicación en Azure AD (App Registrations)
 *  2. Generado un Client Secret para esa aplicación
 *  3. Concedido permisos de aplicación "Sites.ReadWrite.All" (Graph API)
 *     y otorgado el consentimiento de administrador (admin consent)
 *
 * Variables de entorno requeridas (backend/.env):
 *   AZURE_TENANT_ID
 *   AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 */
@Injectable()
export class GraphAuthService {
  private readonly logger = new Logger(GraphAuthService.name);
  private msalApp: ConfidentialClientApplication | null = null;
  readonly configured: boolean;

  constructor() {
    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
    this.configured = Boolean(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET);

    if (this.configured) {
      this.msalApp = new ConfidentialClientApplication({
        auth: {
          clientId: AZURE_CLIENT_ID!,
          authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
          clientSecret: AZURE_CLIENT_SECRET!,
        },
      });
      this.logger.log('Azure AD configurado — la sincronización con SharePoint está activa.');
    } else {
      this.logger.warn(
        'Azure AD no configurado (AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET). ' +
          'La sincronización con SharePoint quedará deshabilitada; los documentos ' +
          'seguirán guardándose localmente sin problema.',
      );
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.configured || !this.msalApp) return null;
    try {
      const result = await this.msalApp.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });
      return result?.accessToken ?? null;
    } catch (err) {
      this.logger.error(`Error obteniendo token de Azure AD: ${err}`);
      return null;
    }
  }
}
