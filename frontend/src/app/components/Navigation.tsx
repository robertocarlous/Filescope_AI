'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Menu, X, Database } from 'lucide-react';
import { ConnectWallet } from '../../components/ConnectWallet';
import toast from 'react-hot-toast';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { isConnected } = useAccount();
  const router = useRouter();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleProtectedNavigation = (path: string, actionName: string) => {
    if (!isConnected) {
      toast.error(`Please connect your wallet first to ${actionName}`, {
        duration: 4000,
        icon: '🔒',
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return;
    }
    router.push(path);
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">FileScope AI</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => handleProtectedNavigation('/upload', 'upload datasets')}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Upload Dataset
            </button>
            <button 
              onClick={() => handleProtectedNavigation('/explorer', 'explore datasets')}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Explore Datasets
            </button>
            <Link 
              href="/sdk"
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              SDK
            </Link>
          </div>

          {/* Right side - Theme toggle and Connect Wallet */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Connect Wallet */}
            <ConnectWallet />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-4">
              <button 
                onClick={() => {
                  handleProtectedNavigation('/upload', 'upload datasets');
                  setIsMenuOpen(false);
                }}
                className="text-left text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                Upload Dataset
              </button>
              <button 
                onClick={() => {
                  handleProtectedNavigation('/explorer', 'explore datasets');
                  setIsMenuOpen(false);
                }}
                className="text-left text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                Explore Datasets
              </button>
              <Link 
                href="/sdk"
                onClick={() => setIsMenuOpen(false)}
                className="text-left text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                SDK
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 