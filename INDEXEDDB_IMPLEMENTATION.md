# IndexedDB File Persistence Implementation

## Overview

IndexedDB storage has been implemented to solve the file persistence issue where files were lost after page refreshes, causing "File size: 0.00 MB" errors during FOC uploads.

## What is IndexedDB?

IndexedDB is a **client-side browser API** that provides persistent storage in the user's browser. It:
- **No backend required** - runs entirely in the browser
- **Persists across page refreshes** - unlike React state or sessionStorage
- **Can store binary data** - stores actual File objects as ArrayBuffers
- **Automatic cleanup** - can be cleared after successful uploads

## Implementation Details

### 1. IndexedDB Service (`frontend/src/services/indexedDB.ts`)

A singleton service class that handles all IndexedDB operations:

- **`storeFile(file, id)`**: Stores a File object in IndexedDB
- **`getFile(id)`**: Retrieves a File object from IndexedDB
- **`hasFile(id)`**: Checks if a file exists
- **`deleteFile(id)`**: Removes a file from IndexedDB
- **`clearAll()`**: Clears all stored files
- **`getFileMetadata(id)`**: Gets file info without loading the full file

### 2. Integration Points

#### File Upload (`handleFileUpload`)
- When a user uploads a file, it's automatically stored in IndexedDB
- This happens before any processing begins

#### FOC Upload (`continueAnalysisMonitoring`)
- Before uploading to FOC, the code checks if the current file is empty/mock
- If so, it retrieves the actual file from IndexedDB
- This ensures the file has real data, not just metadata

#### IPFS Upload (Free Datasets)
- Same logic applies for free datasets uploaded to IPFS
- File is retrieved from IndexedDB if needed

#### State Restoration (`useEffect` on mount)
- When the page loads, it checks for saved state in sessionStorage
- If processing was in progress, it attempts to restore the file from IndexedDB
- Falls back to mock file if IndexedDB doesn't have it

#### Cleanup
- Files are cleared from IndexedDB after successful upload
- Files are cleared when user resets the upload
- Files are cleared when `clearSavedState()` is called

## Benefits

1. **Solves the "File size: 0.00 MB" issue**
   - Files persist across page refreshes
   - Real file data is available, not just mock File objects

2. **Better user experience**
   - Users can refresh the page without losing their upload
   - Payment setup can be completed without losing the file

3. **No backend changes required**
   - Everything happens client-side
   - No additional API endpoints needed

4. **Automatic cleanup**
   - Files are automatically removed after successful uploads
   - Prevents IndexedDB from filling up

## Technical Details

### Database Structure
- **Database Name**: `FileScopeAI`
- **Version**: `1`
- **Store Name**: `uploadedFiles`
- **Key Path**: `id` (defaults to `'current'`)

### File Storage Format
```typescript
interface StoredFile {
  id: string;
  fileData: ArrayBuffer;      // Actual file binary data
  fileName: string;
  fileType: string;
  fileSize: number;
  lastModified: number;
  timestamp: number;
}
```

### File Reconstruction
When retrieving a file, it's reconstructed from the stored ArrayBuffer:
```typescript
const blob = new Blob([storedFile.fileData], { type: storedFile.fileType });
const file = new File([blob], storedFile.fileName, {
  type: storedFile.fileType,
  lastModified: storedFile.lastModified,
});
```

## Error Handling

- IndexedDB operations are wrapped in try-catch blocks
- If IndexedDB fails, the app continues to work (graceful degradation)
- Falls back to mock files if IndexedDB doesn't have the file
- Logs warnings but doesn't crash the app

## Browser Compatibility

IndexedDB is supported in all modern browsers:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅

## Future Enhancements

Potential improvements:
1. Store multiple files (for batch uploads)
2. Add file expiration (auto-delete after X days)
3. Show storage usage to users
4. Allow users to manually clear stored files

## Testing

To test the implementation:
1. Upload a file
2. Check browser DevTools → Application → IndexedDB → FileScopeAI
3. Verify the file is stored
4. Refresh the page
5. Verify the file is restored and upload continues

## Files Modified

- `frontend/src/services/indexedDB.ts` (new file)
- `frontend/src/app/upload/page.tsx` (integrated IndexedDB)

