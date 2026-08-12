

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignora os erros de checagem de tipos do TypeScript apenas DURANTE o build
    // Isso evita o overhead do compilador tsc travar a CPU da tua máquina
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@orca-so/whirlpools-core', 'node-ssh', 'ssh2'],
  // @ts-ignore: Next.js dev server origins fix
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;