import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Transpile AppKit packages to handle ES modules correctly
  transpilePackages: [
    '@reown/appkit',
    '@reown/appkit-adapter-wagmi',
    '@reown/appkit-scaffold-ui',
    '@reown/appkit-ui',
    '@reown/appkit-controllers',
  ],
  webpack: (config, { isServer, webpack }) => {
    // Fix for AppKit module resolution
    // Ensure .js files are resolved correctly from node_modules
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    
    // Don't follow symlinks to avoid resolution issues
    config.resolve.symlinks = true;
    
    // Ensure modules are resolved from node_modules
    config.resolve.modules = ['node_modules', ...(config.resolve.modules || [])];
    
    if (!isServer) {
      // Browser polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
