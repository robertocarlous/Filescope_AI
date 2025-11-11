'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useAppKit, useAppKitNetwork } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { appKitNetworks } from '@/lib/web3';

type AppKitView = 'Connect' | 'Networks' | 'Account';

export function ConnectWallet() {
  const { address, isConnected, isConnecting, chainId } = useAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { open } = useAppKit();

  const supportedChainIds = useMemo(
    () => new Set(appKitNetworks.map((network) => network.id)),
    []
  );

  const isUnsupported =
    typeof chainId === 'number' && !supportedChainIds.has(chainId);

  useEffect(() => {
    if (isConnected) {
      toast.dismiss('connect');
      toast.success('Wallet connected successfully!', {
        icon: '🎉',
      });
    }
  }, [isConnected]);

  const handleOpen = useCallback(
    async (view: AppKitView) => {
      try {
        if (view === 'Connect' && !isConnecting) {
          toast.loading('Opening wallet connection...', { id: 'connect' });
        }
        if (view === 'Networks') {
          toast('Switching networks...', { icon: '🔄' });
        }
        if (view === 'Account') {
          toast('Opening account details...', { icon: '👤' });
        }

        await open({ view });
      } catch (error) {
        toast.dismiss('connect');
        toast.error('Unable to open wallet modal. Please try again.');
        console.error('Failed to open AppKit modal:', error);
      }
    },
    [isConnecting, open]
  );

  const formattedAddress = useMemo(() => {
    if (!address) {
      return 'Account';
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const networkName = caipNetwork?.name ?? 'Unknown Network';

  if (!isConnected) {
    return (
      <button
        onClick={() => handleOpen('Connect')}
        type="button"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg font-medium flex items-center space-x-2"
      >
        <Wallet className="w-4 h-4" />
        <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
      </button>
    );
  }

  if (isUnsupported) {
    return (
      <button
        onClick={() => handleOpen('Networks')}
        type="button"
        className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-all shadow-lg font-medium"
      >
        Wrong network
      </button>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => handleOpen('Networks')}
        type="button"
        className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {networkName}
        </span>
      </button>

      <button
        onClick={() => handleOpen('Account')}
        type="button"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg font-medium text-sm"
      >
        {formattedAddress}
      </button>
    </div>
  );
}