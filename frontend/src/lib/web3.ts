import type { CreateAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { filecoinCalibration } from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Please add it to your environment variables before starting the app.'
  );
}

const networks = [filecoinCalibration] as [typeof filecoinCalibration];

const metadata = {
  name: 'FileScope AI',
  description: 'AI-powered dataset diagnostics and monetization on Filecoin.',
  url: 'https://filescope.ai',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

// AppKit configuration options
export const appKitOptions: CreateAppKit = {
  projectId,
  adapters: [wagmiAdapter],
  networks,
  metadata,
};

// Export networks for use in components
export const appKitNetworks = networks;