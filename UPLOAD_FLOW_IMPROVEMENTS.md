# Upload Flow Improvements

## Changes Made

### 1. Payment Setup Flow
- **Before**: Payment setup happened after analysis started, causing errors when checking analysis status
- **After**: Payment setup is checked BEFORE analysis starts
- **Result**: Clean flow where payment is verified first, then analysis begins

### 2. Step-by-Step Progress UI
- **Before**: Generic progress bar with unclear steps
- **After**: Clear numbered steps showing:
  - Step 1: Payment Setup (for paid datasets)
  - Step 2: File Upload
  - Step 3: AI Analysis
  - Step 4: Dataset Storage (FOC/IPFS)
  - Step 5: Analysis Results Storage
  - Step 6: Blockchain Registration
- **Result**: Users can see exactly what's happening at each stage

### 3. File Validation
- **Before**: File validation was minimal
- **After**: 
  - Validates file size before FOC upload
  - Detects mock files from sessionStorage restoration
  - Provides clear error messages
- **Result**: Better error handling and user guidance

### 4. Error Handling
- **Before**: Generic error messages
- **After**: 
  - Specific error messages for different failure scenarios
  - Better handling of FOC service errors (404, insufficient balance, etc.)
  - Clear guidance on how to recover from errors
- **Result**: Users know exactly what went wrong and how to fix it

## Known Issues

### Issue 1: File Size Shows 0.00 MB
**Symptoms**: 
- File upload to FOC shows 0.00 MB
- FOC upload fails with 404 error

**Root Cause**:
- File objects cannot be serialized to JSON
- When state is restored from sessionStorage, mock File objects are created (size 0)
- Mock files cannot be used for FOC upload

**Workaround**:
- If you refresh the page during upload, you'll need to re-upload the file
- File objects are only valid in the current browser session

**Solution**:
- Consider storing file data in IndexedDB instead of sessionStorage
- Or, prevent state restoration for paid datasets that require FOC upload

### Issue 2: Analysis ID Not Found
**Symptoms**:
- Backend returns 500: "No DatasetAnalysis matches the given query"
- Happens when checking analysis status after payment setup

**Root Cause**:
- Analysis ID from previous attempt is being used
- Analysis hasn't started yet when status is checked

**Solution**:
- Analysis ID is now cleared when payment setup is needed
- Fresh analysis starts after payment setup completes

## Testing Checklist

### Free Dataset Upload
- [ ] Upload a CSV file
- [ ] Verify all steps are shown correctly
- [ ] Verify progress updates in real-time
- [ ] Verify file is uploaded to IPFS
- [ ] Verify analysis results are stored
- [ ] Verify blockchain registration completes

### Paid Dataset Upload
- [ ] Upload a CSV file with monetization enabled
- [ ] Verify payment setup step is shown
- [ ] Complete payment setup (deposit + approval)
- [ ] Verify analysis starts after payment setup
- [ ] Verify file is uploaded to FOC (not IPFS)
- [ ] Verify FOC upload shows correct file size
- [ ] Verify PieceCID is returned
- [ ] Verify blockchain registration includes price

### Error Scenarios
- [ ] Test with empty file (should show error)
- [ ] Test with invalid file type (should show error)
- [ ] Test with file > 100MB (should show error)
- [ ] Test payment setup failure (should show error)
- [ ] Test FOC upload failure (should show error)
- [ ] Test blockchain registration failure (should show error)

### State Restoration
- [ ] Start upload, refresh page (should restore state)
- [ ] Start paid upload, refresh page (should handle file loss)
- [ ] Complete analysis, refresh page (should navigate to results)

## Next Steps

1. **File Persistence**: Consider using IndexedDB to store file data for state restoration
2. **Better Error Recovery**: Add retry logic for failed steps
3. **Progress Persistence**: Store progress in backend for better recovery
4. **File Validation**: Add client-side file validation before upload

