const fs = require('fs');

// .env ファイルが存在する場合は読み込む (ローカル開発用)
if (fs.existsSync('.env')) {
    fs.readFileSync('.env', 'utf8')
        .split('\n')
        .forEach(line => {
            const eqIdx = line.indexOf('=');
            if (eqIdx === -1) return;
            const key = line.slice(0, eqIdx).trim();
            const val = line.slice(eqIdx + 1).trim();
            if (key) process.env[key] = val;
        });
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env or environment variables');
    process.exit(1);
}

fs.writeFileSync('config.js', `window.APP_CONFIG = {
    supabaseUrl: '${url}',
    supabaseKey: '${key}'
};
`);
console.log('config.js generated');
