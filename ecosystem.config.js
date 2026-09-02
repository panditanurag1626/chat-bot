// PM2 process config for the Hostinger VPS.
// Usage on the server (after `npm install && npm run build`):
//   pm2 start ecosystem.config.js
//   pm2 save          # persist across reboots
//   pm2 startup       # then run the command it prints (sets up systemd)
//
// Env vars are read from .env.local / .env.production on the server (Next.js
// loads them automatically). Keep real secrets out of git.
module.exports = {
  apps: [
    {
      name: "chatbotai",
      script: "npm",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
