'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, CheckCircle, AlertCircle, Loader, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { FilecoinCloudService, PaymentStatus } from '../services/filecoinCloud';

interface PaymentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  focService: FilecoinCloudService;
}

export function PaymentSetupModal({
  isOpen,
  onClose,
  onComplete,
  focService,
}: PaymentSetupModalProps) {
  const { address } = useAccount();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [step, setStep] = useState<'check' | 'deposit' | 'approve' | 'complete'>('check');

  // Default amounts (in USDFC, 18 decimals)
  const depositAmount = ethers.parseUnits('100', 18); // 100 USDFC
  const rateAllowance = ethers.parseUnits('10', 18); // 10 USDFC per epoch
  const lockupAllowance = ethers.parseUnits('1000', 18); // 1000 USDFC total
  const maxLockupPeriod = 86400n; // 30 days

  useEffect(() => {
    if (isOpen) {
      checkPaymentStatus();
    }
  }, [isOpen]);

  const checkPaymentStatus = async () => {
    try {
      setIsChecking(true);
      const status = await focService.checkPaymentSetup();
      setPaymentStatus(status);

      if (status.isApproved && !status.needsDeposit) {
        setStep('complete');
        toast.success('Payment setup already complete!');
      } else if (status.needsDeposit) {
        setStep('deposit');
      } else if (status.needsApproval) {
        setStep('approve');
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      toast.error(`Failed to check payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSetup = async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsSettingUp(true);
      setStep('deposit');

      // Setup payments (deposit + approve)
      const results = await focService.setupPayments(
        depositAmount,
        rateAllowance,
        lockupAllowance,
        maxLockupPeriod
      );

      toast.success('Payment setup complete!');
      setStep('complete');
      
      // Wait a bit then close and call onComplete
      setTimeout(() => {
        onComplete();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to setup payments:', error);
      toast.error(`Failed to setup payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('check');
    } finally {
      setIsSettingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wallet className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Filecoin Onchain Cloud Setup
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Why is this needed?
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  To upload monetized datasets to Filecoin Onchain Cloud, you need to:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                  <li>Deposit USDFC tokens for storage payments</li>
                  <li>Approve the Warm Storage service for automated payments</li>
                  <li>This is a one-time setup per wallet</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          {isChecking ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-300">Checking payment status...</span>
            </div>
          ) : paymentStatus && step === 'complete' ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Payment setup complete!
                  </h3>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    You're ready to upload monetized datasets to Filecoin Onchain Cloud.
                  </p>
                </div>
              </div>
            </div>
          ) : paymentStatus ? (
            <div className="space-y-4">
              {/* Status Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Deposit Status</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                    {paymentStatus.needsDeposit ? (
                      <span className="text-red-600">Not Deposited</span>
                    ) : (
                      <span className="text-green-600">Deposited</span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Approval Status</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                    {paymentStatus.isApproved ? (
                      <span className="text-green-600">Approved</span>
                    ) : (
                      <span className="text-red-600">Not Approved</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Setup Requirements */}
              {(!paymentStatus.isApproved || paymentStatus.needsDeposit) && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                        Setup Required
                      </h3>
                      <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                        {paymentStatus.needsDeposit && (
                          <li>Deposit {ethers.formatUnits(depositAmount, 18)} USDFC</li>
                        )}
                        {paymentStatus.needsApproval && (
                          <li>Approve Warm Storage service</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Setup Costs
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Deposit Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ethers.formatUnits(depositAmount, 18)} USDFC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rate Allowance:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ethers.formatUnits(rateAllowance, 18)} USDFC/epoch
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Lockup Allowance:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ethers.formatUnits(lockupAllowance, 18)} USDFC
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">Gas Fees:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ~0.01-0.05 FIL
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Setup Progress */}
          {isSettingUp && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Loader className="w-5 h-5 animate-spin text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {step === 'deposit' && 'Processing deposit...'}
                    {step === 'approve' && 'Approving service...'}
                    {step === 'complete' && 'Setup complete!'}
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    Please confirm the transactions in your wallet.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isSettingUp}
          >
            Cancel
          </button>
          {paymentStatus && (!paymentStatus.isApproved || paymentStatus.needsDeposit) && step !== 'complete' && (
            <button
              onClick={handleSetup}
              disabled={isSettingUp || !address}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSettingUp ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Setting up...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Setup Payments</span>
                </>
              )}
            </button>
          )}
          {step === 'complete' && (
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

