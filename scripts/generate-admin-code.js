const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const envPath = path.resolve(__dirname, '..', '.env');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (/^\s*ADMIN_REGISTRATION_CODE\s*=/m.test(envText)) {
    console.error('ADMIN_REGISTRATION_CODE is already configured. Remove its line from .env first if you need to rotate it.');
    process.exit(1);
}

const code = crypto.randomBytes(24).toString('hex');
const separator = envText.length > 0 && !envText.endsWith('\n') ? '\n' : '';
fs.appendFileSync(envPath, `${separator}ADMIN_REGISTRATION_CODE=${code}\n`, { mode: 0o600 });

console.log('Admin invitation code (share only with the two approved admins):');
console.log(code);