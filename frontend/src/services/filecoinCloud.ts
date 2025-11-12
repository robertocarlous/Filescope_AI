// Filecoin Onchain Cloud (FOC) Service
// Handles FOC storage operations for monetized datasets

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

export interface PaymentStatus {
  isApproved: boolean;
  rateAllowance: bigint;
  rateUsed: bigint;
  maxLockupPeriod: bigint;
  needsDeposit: boolean;
  needsApproval: boolean;
  currentBalance?: bigint;
}

export interface UploadResult {
  pieceCid: string;
  dataSetId?: number;
}

export class FilecoinCloudService {
  private synapse: Synapse | null = null;
  private provider: ethers.BrowserProvider | null = null;

  /**
   * Initialize the FOC service with a browser provider (MetaMask, etc.)
   */
  async initialize(ethereumProvider: typeof window.ethereum): Promise<void> {
    try {
      this.provider = new ethers.BrowserProvider(ethereumProvider);
      this.synapse = await Synapse.create({ 
        provider: this.provider,
        // Use calibration testnet for now
        // rpcURL: RPC_URLS.calibration.websocket
      });
      console.log('✅ Filecoin Cloud service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Filecoin Cloud service:', error);
      throw new Error(`Failed to initialize FOC service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if payment setup is complete
   */
  async checkPaymentSetup(): Promise<PaymentStatus> {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      const warmStorageAddress = await this.synapse.getWarmStorageAddress();
      const serviceStatus = await this.synapse.payments.serviceApproval(warmStorageAddress);

      // If not approved, we need setup (both deposit and approval)
      // If approved but rateAllowance is 0, we might need more allowance
      const needsSetup = !serviceStatus.isApproved || serviceStatus.rateAllowance === 0n;

      return {
        isApproved: serviceStatus.isApproved,
        rateAllowance: serviceStatus.rateAllowance,
        rateUsed: serviceStatus.rateUsed,
        maxLockupPeriod: serviceStatus.maxLockupPeriod,
        needsDeposit: needsSetup, // Assume deposit needed if not approved
        needsApproval: !serviceStatus.isApproved,
        currentBalance: undefined, // Not available from SDK directly
      };
    } catch (error) {
      console.error('❌ Failed to check payment setup:', error);
      // If error checking, assume setup is needed
      return {
        isApproved: false,
        rateAllowance: 0n,
        rateUsed: 0n,
        maxLockupPeriod: 0n,
        needsDeposit: true,
        needsApproval: true,
        currentBalance: undefined,
      };
    }
  }

  /**
   * Setup payments (deposit and approve service)
   */
  async setupPayments(
    depositAmount: bigint,
    rateAllowance: bigint,
    lockupAllowance: bigint,
    maxLockupPeriod: bigint = 86400n // 30 days default
  ): Promise<{ depositTx?: string; approvalTx?: string }> {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      const results: { depositTx?: string; approvalTx?: string } = {};

      // 1. Deposit USDFC tokens
      console.log('💰 Depositing USDFC tokens...');
      const depositTx = await this.synapse.payments.deposit(depositAmount);
      results.depositTx = depositTx.hash;
      console.log('✅ Deposit transaction:', depositTx.hash);
      
      // Wait for deposit to be confirmed
      await depositTx.wait();
      console.log('✅ Deposit confirmed');

      // 2. Approve Warm Storage service
      console.log('✅ Approving Warm Storage service...');
      const warmStorageAddress = await this.synapse.getWarmStorageAddress();
      const approvalTx = await this.synapse.payments.approveService(
        warmStorageAddress,
        rateAllowance,
        lockupAllowance,
        maxLockupPeriod
      );
      results.approvalTx = approvalTx.hash;
      console.log('✅ Approval transaction:', approvalTx.hash);
      
      // Wait for approval to be confirmed
      await approvalTx.wait();
      console.log('✅ Approval confirmed');

      return results;
    } catch (error) {
      console.error('❌ Failed to setup payments:', error);
      throw new Error(`Failed to setup payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload dataset to FOC
   */
  async uploadDataset(
    file: File,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      // Validate file
      if (!file || file.size === 0) {
        throw new Error('Invalid file: File is empty or not provided');
      }

      console.log(`📤 Uploading ${file.name} to Filecoin Onchain Cloud...`);
      console.log(`📊 File details:`, {
        name: file.name,
        size: file.size,
        sizeMB: (file.size / 1024 / 1024).toFixed(2),
        type: file.type
      });

      // Convert file to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (data.length === 0) {
        throw new Error('File data is empty after conversion');
      }

      console.log(`📊 Converted to Uint8Array: ${data.length} bytes`);

      // Upload with metadata
      const result = await this.synapse.storage.upload(data, {
        metadata: metadata || {},
      });

      console.log('✅ Upload complete! PieceCID:', result.pieceCid);
      
      return {
        pieceCid: result.pieceCid,
        dataSetId: result.dataSetId,
      };
    } catch (error) {
      console.error('❌ Failed to upload dataset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide more helpful error messages
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        throw new Error('FOC service endpoint not found. Please check your network connection and try again.');
      } else if (errorMessage.includes('insufficient')) {
        throw new Error('Insufficient USDFC balance. Please deposit more tokens.');
      } else if (errorMessage.includes('empty')) {
        throw new Error('File is empty. Please upload a valid file.');
      }
      
      throw new Error(`Failed to upload dataset: ${errorMessage}`);
    }
  }

  /**
   * Download dataset from FOC
   */
  async downloadDataset(pieceCid: string): Promise<Uint8Array> {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      console.log(`📥 Downloading dataset: ${pieceCid}...`);
      const data = await this.synapse.storage.download(pieceCid);
      console.log('✅ Download complete!');
      return data;
    } catch (error) {
      console.error('❌ Failed to download dataset:', error);
      throw new Error(`Failed to download dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage information (pricing, providers, etc.)
   */
  async getStorageInfo() {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      const info = await this.synapse.getStorageInfo();
      return info;
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      throw new Error(`Failed to get storage info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preflight check before upload
   */
  async preflightUpload(dataSize: number) {
    if (!this.synapse) {
      throw new Error('Synapse not initialized. Call initialize() first.');
    }

    try {
      const preflight = await this.synapse.storage.preflightUpload(dataSize);
      return preflight;
    } catch (error) {
      console.error('❌ Failed to preflight upload:', error);
      throw new Error(`Failed to preflight upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.synapse) {
        const provider = this.synapse.getProvider();
        if (provider && typeof provider.destroy === 'function') {
          await provider.destroy();
          console.log('✅ FOC service cleaned up');
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup FOC service:', error);
    }
  }

  /**
   * Get the network this instance is connected to
   */
  getNetwork(): string | null {
    if (!this.synapse) {
      return null;
    }
    return this.synapse.getNetwork();
  }
}

// Singleton instance
let focServiceInstance: FilecoinCloudService | null = null;

export const getFilecoinCloudService = (): FilecoinCloudService => {
  if (!focServiceInstance) {
    focServiceInstance = new FilecoinCloudService();
  }
  return focServiceInstance;
};

