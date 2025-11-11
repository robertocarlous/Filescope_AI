# Filecoin Onchain Cloud (FOC) - Synapse SDK Research & Implementation Guide

## Overview

**Filecoin Onchain Cloud (FOC)** is a smart-contract based marketplace for storage and other services in the Filecoin ecosystem. The **Synapse SDK** provides a JavaScript/TypeScript interface to interact with FOC's decentralized services.

### Key Benefits
- **Warm Storage Service (FWSS)**: Fast, persistent, and verifiable data storage
- **Proof of Data Possession (PDP)**: Cryptographic proofs that verify storage providers are actually storing data
- **Filecoin Pay**: Programmable payments and auditable billing
- **Filecoin Beam**: CDN-like retrieval for fast data access
- **On-chain Settlement**: Automated payment streams (rails) between clients and providers

---

## Installation

### Package Details
- **Package Name**: `@filoz/synapse-sdk`
- **Peer Dependency**: `ethers` v6 (must be installed separately)
- **Repository**: https://github.com/FilOzone/synapse-sdk
- **Documentation**: https://synapse.filecoin.services/

### Installation Command
```bash
pnpm install @filoz/synapse-sdk ethers
# or
npm install @filoz/synapse-sdk ethers
```

**Note**: The project uses `ethers` v6, which is already compatible with `wagmi` v2 and `viem` v2.

---

## Key Concepts

### 1. **Service Contracts**
Smart contracts that manage specific services (like storage). Currently, **Warm Storage** is the primary service contract that handles storage operations and payment validation.

### 2. **Payment Rails**
Automated payment streams between clients and service providers, managed by the Payments contract. When you create a data set in Warm Storage, it automatically creates corresponding payment rails.

### 3. **Data Sets**
Collections of stored data managed by Warm Storage. Each data set has an associated payment rail that handles the ongoing storage payments.

### 4. **Pieces**
Individual units of data identified by **PieceCID** (content-addressed identifiers). Multiple pieces can be added to a data set for storage.

### 5. **PDP (Proof of Data Possession)**
The cryptographic protocol that verifies storage providers are actually storing the data they claim to store. Providers must periodically prove they possess the data.

### 6. **Validators**
Service contracts (like Warm Storage) act as validators for payment settlements, ensuring services are delivered before payments are released.

---

## SDK Initialization

### Option 1: With MetaMask/Browser Provider (Recommended for Frontend)

```typescript
import { Synapse } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

// Connect to MetaMask or other browser wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const synapse = await Synapse.create({ provider });

// Start uploading immediately
const data = new TextEncoder().encode('Your data here');
const result = await synapse.storage.upload(data);
console.log(`Stored with PieceCID: ${result.pieceCid}`);
```

### Option 2: With Private Key (Backend/Server)

```typescript
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';

const synapse = await Synapse.create({
  privateKey: '0x...',
  rpcURL: RPC_URLS.calibration.websocket // Use calibration testnet for testing
});
```

### Option 3: With Wagmi Provider (Integration with Existing Setup)

Since we're using `wagmi` v2, we can integrate with the existing provider:

```typescript
import { Synapse } from '@filoz/synapse-sdk';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';

// In your component
const { address } = useAccount();
const publicClient = usePublicClient();

// Convert wagmi client to ethers provider
const provider = new ethers.BrowserProvider(window.ethereum);
const synapse = await Synapse.create({ provider });
```

---

## Payment Setup (Required Before Upload)

Before uploading data, you need to:

1. **Deposit USDFC tokens** (one-time setup)
2. **Approve the Warm Storage service contract** for automated payments

### Complete Payment Setup Example

```typescript
import { TOKENS, CONTRACT_ADDRESSES } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

// 1. Deposit USDFC tokens (one-time setup)
const amount = ethers.parseUnits('100', 18); // 100 USDFC
await synapse.payments.deposit(amount);

// 2. Approve the Warm Storage service contract for automated payments
const warmStorageAddress = await synapse.getWarmStorageAddress();
await synapse.payments.approveService(
  warmStorageAddress,
  ethers.parseUnits('10', 18),   // Rate allowance: 10 USDFC per epoch
  ethers.parseUnits('1000', 18), // Lockup allowance: 1000 USDFC total
  86400n                          // Max lockup period: 30 days (in epochs)
);

// Now you're ready to use storage!
```

### Checking Payment Status

```typescript
// Check current allowance
const paymentsAddress = await synapse.getPaymentsAddress();
const currentAllowance = await synapse.payments.allowance(paymentsAddress);

// Check service approval status
const serviceStatus = await synapse.payments.serviceApproval(warmStorageAddress);
console.log('Service approved:', serviceStatus.isApproved);
console.log('Rate allowance:', serviceStatus.rateAllowance);
```

---

## Storage Operations

### Basic Upload

```typescript
// Upload data, this auto-selects provider and creates a data set if needed
// (your first upload will take longer than subsequent uploads due to set up)
const uploadResult = await synapse.storage.upload(
  new TextEncoder().encode('🚀 Welcome to decentralized storage on Filecoin!')
);
console.log(`Upload complete! PieceCID: ${uploadResult.pieceCid}`);
```

### Upload with File (Frontend)

```typescript
// Convert File to Uint8Array
const file = event.target.files[0];
const arrayBuffer = await file.arrayBuffer();
const data = new Uint8Array(arrayBuffer);

// Upload
const result = await synapse.storage.upload(data);
console.log(`PieceCID: ${result.pieceCid}`);
```

### Storage Context (Advanced)

For more control over provider selection and metadata:

```typescript
// Create storage context with metadata
const contexts = await synapse.storage.createContexts({
  metadata: {
    app: 'filescope-ai',
    category: 'datasets'
  },
  withCDN: true, // Enable CDN for faster downloads
  callbacks: {
    onProviderSelected: (provider) => {
      console.log(`Selected provider: ${provider.owner}`);
    },
    onDataSetResolved: (info) => {
      if (info.isExisting) {
        console.log(`Using existing data set: ${info.dataSetId}`);
      } else {
        console.log(`Created new data set: ${info.dataSetId}`);
      }
    }
  }
});

// Upload to specific context
const result = await contexts[0].upload(data, {
  metadata: {
    snapshotVersion: 'v2.1.0',
    generator: 'filescope-upload'
  },
  onUploadComplete: (pieceCid) => {
    console.log(`Upload complete! PieceCID: ${pieceCid}`);
  }
});
```

### Download

```typescript
// Download from any provider
const data = await synapse.storage.download(pieceCid);
console.log('Retrieved:', new TextDecoder().decode(data));

// Download with CDN optimization
const dataWithCDN = await synapse.storage.download(pieceCid, { 
  withCDN: true 
});

// Download from specific provider
const dataFromProvider = await synapse.storage.download(pieceCid, {
  providerAddress: '0x...'
});
```

### Preflight Check (Before Upload)

```typescript
// Check if an upload is possible before attempting it
const preflight = await synapse.storage.preflightUpload(dataSize);
console.log('Estimated costs:', preflight.estimatedCost);
console.log('Allowance sufficient:', preflight.allowanceCheck.sufficient);
```

---

## Integration with FileScope AI

### Current Architecture

1. **Upload Flow**: User uploads file → Backend analyzes → IPFS upload → Smart contract registration
2. **Storage**: Currently using IPFS (Pinata) for storage
3. **Smart Contract**: `FileScopeRegistry.sol` stores dataset CID and analysis CID

### Proposed Integration Strategy

#### Option A: Replace IPFS with FOC (Full Migration)
- Upload dataset directly to FOC during upload flow
- Store PieceCID in smart contract instead of IPFS CID
- Benefits: Verifiable proofs, programmable payments, CDN access

#### Option B: Hybrid Approach (Recommended)
- Keep IPFS for initial storage (fast, free tier)
- Optionally upload to FOC for warm storage (verifiable, persistent)
- Store both CIDs in smart contract
- Benefits: Flexibility, gradual migration

#### Option C: FOC as Premium Feature
- Free tier: IPFS only
- Paid tier: FOC warm storage with verifiable proofs
- Benefits: Cost-effective, user choice

### Implementation Plan

#### 1. Create FOC Service Module

```typescript
// frontend/src/services/filecoinCloud.ts
import { Synapse } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

export class FilecoinCloudService {
  private synapse: Synapse | null = null;

  async initialize(provider: ethers.Provider) {
    this.synapse = await Synapse.create({ provider });
    return this.synapse;
  }

  async checkPaymentSetup() {
    if (!this.synapse) throw new Error('Synapse not initialized');
    
    const warmStorageAddress = await this.synapse.getWarmStorageAddress();
    const serviceStatus = await this.synapse.payments.serviceApproval(warmStorageAddress);
    
    return {
      isApproved: serviceStatus.isApproved,
      rateAllowance: serviceStatus.rateAllowance,
      rateUsed: serviceStatus.rateUsed,
      needsDeposit: false, // Check deposit separately
      needsApproval: !serviceStatus.isApproved
    };
  }

  async setupPayments(amount: bigint, rateAllowance: bigint, lockupAllowance: bigint) {
    if (!this.synapse) throw new Error('Synapse not initialized');
    
    // Deposit
    await this.synapse.payments.deposit(amount);
    
    // Approve service
    const warmStorageAddress = await this.synapse.getWarmStorageAddress();
    await this.synapse.payments.approveService(
      warmStorageAddress,
      rateAllowance,
      lockupAllowance,
      86400n // 30 days
    );
  }

  async uploadDataset(file: File, metadata?: Record<string, string>) {
    if (!this.synapse) throw new Error('Synapse not initialized');
    
    // Convert file to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Upload with metadata
    const result = await this.synapse.storage.upload(data, {
      metadata: metadata || {}
    });
    
    return {
      pieceCid: result.pieceCid,
      dataSetId: result.dataSetId // If available
    };
  }

  async downloadDataset(pieceCid: string) {
    if (!this.synapse) throw new Error('Synapse not initialized');
    
    const data = await this.synapse.storage.download(pieceCid);
    return data;
  }

  async cleanup() {
    if (this.synapse) {
      const provider = this.synapse.getProvider();
      if (provider && typeof provider.destroy === 'function') {
        await provider.destroy();
      }
    }
  }
}
```

#### 2. Update Upload Flow

```typescript
// In frontend/src/app/upload/page.tsx

import { FilecoinCloudService } from '@/services/filecoinCloud';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';

// In component
const { address, isConnected } = useAccount();
const publicClient = usePublicClient();
const [focService, setFocService] = useState<FilecoinCloudService | null>(null);

// Initialize FOC service when wallet connects
useEffect(() => {
  if (isConnected && window.ethereum) {
    const service = new FilecoinCloudService();
    const provider = new ethers.BrowserProvider(window.ethereum);
    service.initialize(provider).then(() => {
      setFocService(service);
    });
  }
}, [isConnected]);

// In upload handler
const handleFOCUpload = async (file: File) => {
  if (!focService) {
    throw new Error('Filecoin Cloud service not initialized');
  }
  
  // Check payment setup
  const paymentStatus = await focService.checkPaymentSetup();
  
  if (paymentStatus.needsApproval) {
    // Show payment setup modal
    // User needs to approve service and deposit funds
    return;
  }
  
  // Upload to FOC
  const result = await focService.uploadDataset(file, {
    app: 'filescope-ai',
    datasetName: file.name,
    uploadedBy: address
  });
  
  return result.pieceCid;
};
```

#### 3. Update Smart Contract Interaction

```typescript
// Store PieceCID instead of IPFS CID
writeContract({
  address: fileStoreContract.address as `0x${string}`,
  abi: fileStoreContract.abi,
  functionName: 'uploadDataset',
  args: [
    pieceCid,      // FOC PieceCID instead of IPFS CID
    analysisCid,   // Keep analysis on IPFS or also move to FOC
    isPublic
  ],
});
```

---

## Network Configuration

### Supported Networks
- **Calibration Testnet**: `RPC_URLS.calibration.websocket` (for testing)
- **Mainnet**: `RPC_URLS.mainnet.websocket` (for production)

### RPC URLs
```typescript
import { RPC_URLS } from '@filoz/synapse-sdk';

// Calibration (testnet)
const calibrationRPC = RPC_URLS.calibration.websocket;

// Mainnet
const mainnetRPC = RPC_URLS.mainnet.websocket;
```

---

## Error Handling

```typescript
try {
  const result = await synapse.storage.upload(data);
} catch (error) {
  if (error.message.includes('insufficient funds')) {
    // Handle payment issue
  } else if (error.message.includes('provider')) {
    // Handle provider selection issue
  } else {
    // Generic error handling
  }
}
```

---

## Connection Management

When using WebSocket connections, properly clean up:

```typescript
// When you're done with the SDK, close the connection
const provider = synapse.getProvider();
if (provider && typeof provider.destroy === 'function') {
  await provider.destroy();
}
```

---

## Cost Considerations

### Storage Costs
- Pricing is per TiB/month
- CDN option may have additional costs
- Check `synapse.getStorageInfo()` for current pricing

### Payment Rails
- **Rate Allowance**: Amount per epoch (30 seconds)
- **Lockup Allowance**: Total amount that can be locked
- **Settlement Fee**: 0.0013 FIL burned per settlement (network fee)

### Example Cost Calculation
```typescript
const info = await synapse.getStorageInfo();
console.log('Price per TiB/month:', info.pricing.noCDN.perTiBPerMonth);
```

---

## Next Steps

1. **Install SDK**: Add `@filoz/synapse-sdk` and `ethers` to `frontend/package.json`
2. **Create Service Module**: Implement `FilecoinCloudService` class
3. **Payment Setup UI**: Create modal/component for payment approval
4. **Update Upload Flow**: Integrate FOC upload option in upload page
5. **Update Smart Contract**: Consider storing PieceCID alongside IPFS CID
6. **Testing**: Test on Calibration testnet first
7. **Documentation**: Update README with FOC integration details

---

## Resources

- **Official Documentation**: https://synapse.filecoin.services/
- **Getting Started**: https://synapse.filecoin.services/gettingstarted/getting-started/
- **Storage Guide**: https://synapse.filecoin.services/guides/storage/
- **GitHub Repository**: https://github.com/FilOzone/synapse-sdk
- **API Reference**: https://synapse.filecoin.services/api/synapse/classes/synapse/

---

## Questions to Consider

1. **Payment Model**: Who pays for storage? User or platform?
2. **Migration Strategy**: Full migration or hybrid approach?
3. **User Experience**: How to handle payment setup flow?
4. **Cost Management**: How to estimate and display costs to users?
5. **Error Recovery**: How to handle failed uploads or payment issues?

---

## Notes

- The SDK handles all blockchain interactions, provider selection, and data management
- First upload takes longer due to data set creation
- Subsequent uploads to the same data set are faster
- CDN option provides faster retrieval but may have additional costs
- Telemetry is enabled by default on calibration network (can be disabled)

