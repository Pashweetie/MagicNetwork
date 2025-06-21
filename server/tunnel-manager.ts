import { spawn } from "child_process";

export class TunnelManager {
  private currentUrl: string | null = null;
  private tunnelProcess: any = null;

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  setCurrentUrl(url: string) {
    this.currentUrl = url;
    (global as any).currentTunnelUrl = url;
    console.log(`🔄 Updated tunnel URL: ${url}`);
  }

  async createNamedTunnel(apiToken: string): Promise<string | null> {
    try {
      console.log('🚀 Creating permanent named tunnel...');
      
      // First, get account ID
      const accountResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const accountData = await accountResponse.json();
      if (!accountData.success || !accountData.result?.[0]) {
        throw new Error('Failed to get account information');
      }

      const accountId = accountData.result[0].id;

      // Create a new tunnel
      const tunnelResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `mtg-app-${Date.now()}`,
          tunnel_secret: this.generateTunnelSecret()
        })
      });

      const tunnelData = await tunnelResponse.json();
      if (!tunnelData.success) {
        throw new Error(`Failed to create tunnel: ${tunnelData.errors?.[0]?.message || 'Unknown error'}`);
      }

      const tunnelId = tunnelData.result.id;
      console.log(`✅ Created permanent tunnel: ${tunnelId}`);

      // Start the tunnel
      this.startTunnel(tunnelId, apiToken);
      
      return tunnelId;
    } catch (error) {
      console.error('❌ Failed to create named tunnel:', error);
      return null;
    }
  }

  private generateTunnelSecret(): string {
    // Generate a 32-byte base64 secret
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('base64');
  }

  private startTunnel(tunnelId: string, apiToken?: string) {
    const args = ['tunnel', '--url', 'http://localhost:5000', 'run', tunnelId];
    
    this.tunnelProcess = spawn('cloudflared', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        ...(apiToken && { CLOUDFLARE_API_TOKEN: apiToken })
      }
    });

    this.setupTunnelLogging();
  }

  private setupTunnelLogging() {
    if (!this.tunnelProcess) return;

    this.tunnelProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      
      // Extract tunnel URL
      const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.(?:trycloudflare\.com|cfargotunnel\.com)/);
      if (urlMatch && !this.currentUrl) {
        this.setCurrentUrl(urlMatch[0]);
      }
    });

    this.tunnelProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      if (error.includes('ERR') || error.includes('error')) {
        console.log(`Tunnel error: ${error.trim()}`);
      }
    });

    this.tunnelProcess.on('exit', (code: number) => {
      if (code !== 0) {
        console.log('❌ Named tunnel failed, falling back to quick tunnel');
        this.startQuickTunnel();
      }
    });
  }

  startQuickTunnel() {
    console.log('⚡ Starting fallback quick tunnel...');
    
    this.tunnelProcess = spawn('cloudflared', [
      'tunnel', 
      '--url', 'http://localhost:5000',
      '--protocol', 'http2',
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.setupTunnelLogging();
  }

  stop() {
    if (this.tunnelProcess) {
      this.tunnelProcess.kill();
      this.tunnelProcess = null;
      this.currentUrl = null;
    }
  }
}

export const tunnelManager = new TunnelManager();