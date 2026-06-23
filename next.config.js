/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // The eSSL/ZKTeco ADMS device calls /iclock/cdata
      // This rewrite ensures it works whether the proxy passes /iclock/ or /api/iclock/
      {
        source: '/api/iclock/cdata',
        destination: '/iclock/cdata',
      },
    ];
  },
};

module.exports = nextConfig;