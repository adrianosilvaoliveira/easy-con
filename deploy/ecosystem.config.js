module.exports = {
  apps: [
    {
      name: 'hospital-stock-api',
      script: './dist/server.js',
      cwd: '/var/www/hospital-stock/backend',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3333,
      },
      error_file: '/var/log/pm2/hospital-stock-error.log',
      out_file: '/var/log/pm2/hospital-stock-out.log',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
    },
  ],
};
