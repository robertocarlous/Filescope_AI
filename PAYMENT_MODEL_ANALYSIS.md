# Filecoin Onchain Cloud Payment Model Analysis

## Question: Who Pays for the One-Time Setup?

The one-time payment setup in Filecoin Onchain Cloud involves:
1. **Depositing USDFC tokens** into the payment contract
2. **Approving the Warm Storage service** for automated payments

This is a **business decision** that depends on your platform's model. Here are the options:

---

## Option 1: User Pays (Decentralized Model) ✅ Recommended for Most Cases

### How It Works
- Users connect their wallet
- Users deposit USDFC tokens (e.g., 100 USDFC)
- Users approve the Warm Storage service contract
- Users pay for their own storage costs ongoing

### Pros
- ✅ **Decentralized**: Users control their own storage and payments
- ✅ **No platform costs**: You don't bear storage costs
- ✅ **Scalable**: Works regardless of user volume
- ✅ **Transparent**: Users see exactly what they're paying for
- ✅ **Aligns with Web3 principles**: True ownership and control

### Cons
- ❌ **User friction**: Extra steps during onboarding
- ❌ **Requires USDFC tokens**: Users need to acquire tokens first
- ❌ **Learning curve**: Users need to understand payment rails

### Implementation
```typescript
// User flow:
1. Connect wallet
2. Check if payment setup is complete
3. If not, show payment setup modal:
   - Explain what USDFC is needed
   - Show deposit amount (e.g., 100 USDFC)
   - User approves and deposits
4. User can now upload to FOC
```

### Best For
- Decentralized platforms
- Platforms where users monetize their data
- Platforms with Web3-native users
- Long-term sustainable models

---

## Option 2: Platform Pays (Subsidized Model)

### How It Works
- Platform maintains a service wallet with USDFC
- Platform deposits funds on behalf of users (or uses shared pool)
- Platform approves service for all users
- Platform pays for all storage costs

### Pros
- ✅ **Better UX**: No friction for users
- ✅ **Faster onboarding**: Users can upload immediately
- ✅ **No token acquisition needed**: Users don't need USDFC
- ✅ **Easier for non-Web3 users**: Traditional web app feel

### Cons
- ❌ **Platform costs**: You pay for all storage
- ❌ **Not scalable**: Costs grow with user base
- ❌ **Centralized**: Goes against Web3 principles
- ❌ **Requires funding**: You need USDFC reserves
- ❌ **Ongoing management**: Need to monitor and refill deposits

### Implementation
```typescript
// Platform flow:
1. Platform maintains service wallet with USDFC
2. When user uploads:
   - Check if user has payment setup
   - If not, platform wallet deposits/approves on user's behalf
   - OR use a shared payment pool
3. Platform monitors and refills deposits as needed
```

### Best For
- B2B platforms
- Platforms with subscription model (you can charge users)
- Platforms with VC funding
- Traditional SaaS transitioning to Web3

---

## Option 3: Hybrid Model (Recommended for FileScope AI) 🎯

### How It Works
- **Free tier**: Use IPFS (Pinata free tier) - no payment needed
- **Premium tier**: Users pay for FOC storage with verifiable proofs
- **Platform option**: Platform can subsidize for featured/promoted datasets

### Pros
- ✅ **Flexibility**: Users choose their storage tier
- ✅ **Low barrier to entry**: Free IPFS option
- ✅ **Premium features**: FOC as value-added service
- ✅ **Sustainable**: Users who need FOC pay for it
- ✅ **Platform control**: You can subsidize specific use cases

### Cons
- ⚠️ **More complex**: Need to manage two storage systems
- ⚠️ **User education**: Need to explain the difference

### Implementation
```typescript
// Upload flow:
1. User uploads file
2. Show storage options:
   - Free: IPFS (fast, no cost, no proofs)
   - Premium: FOC (verifiable proofs, CDN, programmable payments)
3. If FOC selected:
   - User pays setup (or platform subsidizes)
   - Upload to FOC
4. Store appropriate CID in smart contract
```

### Best For
- **FileScope AI** (your use case!)
- Platforms with freemium model
- Platforms transitioning from centralized to decentralized
- Platforms that want to offer choice

---

## Option 4: Platform Pays Setup, Users Pay Storage

### How It Works
- Platform pays the one-time setup (deposit + approval)
- Users pay for ongoing storage costs via payment rails
- Platform can set limits (e.g., first 1 GB free, then user pays)

### Pros
- ✅ **Reduced friction**: No setup for users
- ✅ **User responsibility**: Users pay for their usage
- ✅ **Platform control**: You control initial barrier

### Cons
- ⚠️ **Setup costs**: You pay for every user's setup
- ⚠️ **Complex accounting**: Need to track who paid what

### Best For
- Platforms with user subscription fees
- Platforms that can recoup setup costs

---

## Recommendation for FileScope AI

Based on your current architecture:

### Current State
- ✅ Free IPFS uploads (Pinata)
- ✅ Paid dataset feature (users can monetize)
- ✅ Users already connect wallets
- ✅ Web3-native platform

### Recommended: **Hybrid Model (Option 3)**

**Implementation Strategy:**

1. **Default**: Keep IPFS as free option
   - No payment setup needed
   - Fast uploads
   - Works for most users

2. **Premium Option**: Add FOC as premium feature
   - Users who want verifiable proofs pay for setup
   - Users who monetize datasets can use FOC for credibility
   - Platform can optionally subsidize for featured datasets

3. **UI Flow**:
   ```
   Upload Page:
   - [ ] Free Storage (IPFS) - Recommended
   - [ ] Premium Storage (FOC) - Verifiable Proofs, CDN
   
   If FOC selected:
   - Show payment setup modal
   - User deposits USDFC and approves
   - Upload to FOC
   ```

4. **Smart Contract**:
   - Store both IPFS CID and FOC PieceCID (if available)
   - Display appropriate download link based on storage type

### Why This Works
- ✅ **No barrier to entry**: Free IPFS option
- ✅ **Premium value**: FOC for users who need it
- ✅ **Sustainable**: Users pay for premium features
- ✅ **Flexible**: You can subsidize specific cases
- ✅ **Scalable**: Platform doesn't bear all costs

---

## Cost Breakdown

### User Pays Setup (One-Time)
- **Deposit**: ~100 USDFC (adjustable)
- **Approval**: Gas fees only
- **Ongoing**: Payment rails automatically deduct storage costs

### Platform Pays Setup (Per User)
- **Deposit**: ~100 USDFC per user
- **Approval**: Gas fees per user
- **Ongoing**: Platform pays all storage costs
- **Scale**: 1000 users = 100,000 USDFC + gas fees

### Storage Costs (Ongoing)
- **Per TiB/month**: Varies by provider (check `getStorageInfo()`)
- **Payment rails**: Automatically deduct from deposit
- **Settlement fee**: 0.0013 FIL per settlement (burned to network)

---

## Implementation Example

### User Pays Model
```typescript
// Check if user has payment setup
const paymentStatus = await focService.checkPaymentSetup();

if (!paymentStatus.isApproved) {
  // Show payment setup modal
  showPaymentSetupModal({
    depositAmount: ethers.parseUnits('100', 18), // 100 USDFC
    rateAllowance: ethers.parseUnits('10', 18),  // 10 USDFC per epoch
    lockupAllowance: ethers.parseUnits('1000', 18), // 1000 USDFC total
    onComplete: async () => {
      // User has completed setup, proceed with upload
      await handleFOCUpload(file);
    }
  });
} else {
  // User is ready, proceed with upload
  await handleFOCUpload(file);
}
```

### Platform Pays Model
```typescript
// Platform service wallet handles setup
const platformWallet = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY);
const platformSynapse = await Synapse.create({
  privateKey: platformWallet.privateKey,
  rpcURL: RPC_URLS.calibration.websocket
});

// Setup payment for user (platform pays)
await platformSynapse.payments.deposit(
  ethers.parseUnits('100', 18),
  { to: userAddress } // Deposit to user's address
);

// User can now upload (platform has subsidized setup)
```

---

## Decision Matrix

| Factor | User Pays | Platform Pays | Hybrid |
|--------|-----------|---------------|--------|
| **User Friction** | High | Low | Medium |
| **Platform Cost** | Low | High | Low |
| **Scalability** | High | Low | High |
| **Web3 Alignment** | High | Low | Medium |
| **UX** | Medium | High | High |
| **Sustainability** | High | Low | High |

---

## Next Steps

1. **Decide on payment model** based on your business goals
2. **Implement payment setup UI** for chosen model
3. **Test on Calibration testnet** first
4. **Monitor costs** and adjust as needed
5. **Document** the payment flow for users

---

## Questions to Answer

1. **Who is your target user?**
   - Web3-native users → User pays
   - Traditional users → Platform pays or hybrid

2. **What's your business model?**
   - Free platform → User pays
   - Subscription → Platform can pay
   - Freemium → Hybrid

3. **What's your budget?**
   - Limited budget → User pays
   - Well-funded → Platform can pay

4. **What's your growth plan?**
   - Fast growth → User pays (scalable)
   - Controlled growth → Platform can pay

---

## Conclusion

For **FileScope AI**, I recommend the **Hybrid Model**:
- Keep IPFS as free default
- Add FOC as premium option (user pays)
- Platform can subsidize for featured datasets
- Best balance of UX, sustainability, and scalability

This aligns with your current architecture and gives users choice while keeping the platform sustainable.

