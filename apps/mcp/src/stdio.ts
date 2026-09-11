import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CredentialStore } from './auth.js';
import { registerServer } from './tools.js';

const wallet = process.env.AFFEST_WALLET ?? 'local';
const credentials = new CredentialStore('stdio');
const issued = credentials.issue(wallet, 'stdio', ['read', 'plan', 'proof', 'action']);
const auth = credentials.authenticate(`Bearer ${issued.token}`);
if (!auth) throw new Error('stdio credential failed');

const server = registerServer(auth, credentials);
const transport = new StdioServerTransport();
await server.connect(transport);
