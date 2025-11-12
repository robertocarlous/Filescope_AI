/**
 * IndexedDB service for storing file data persistently
 * This allows files to survive page refreshes and be retrieved for FOC upload
 */

const DB_NAME = 'FileScopeAI';
const DB_VERSION = 1;
const STORE_NAME = 'uploadedFiles';

interface StoredFile {
  id: string;
  fileData: ArrayBuffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  lastModified: number;
  timestamp: number;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Store a file in IndexedDB
   */
  async storeFile(file: File, id: string = 'current'): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    // Convert file to ArrayBuffer first
    const arrayBuffer = await file.arrayBuffer();
    
    return new Promise((resolve, reject) => {
      const storedFile: StoredFile = {
        id,
        fileData: arrayBuffer,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        lastModified: file.lastModified,
        timestamp: Date.now(),
      };

      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(storedFile);

      request.onsuccess = () => {
        console.log('✅ File stored in IndexedDB:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to store file in IndexedDB'));
      };
    });
  }

  /**
   * Retrieve a file from IndexedDB
   */
  async getFile(id: string = 'current'): Promise<File | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const storedFile = request.result as StoredFile | undefined;
        
        if (!storedFile) {
          console.log('📭 No file found in IndexedDB');
          resolve(null);
          return;
        }

        // Reconstruct File object from stored data
        const blob = new Blob([storedFile.fileData], { type: storedFile.fileType });
        const file = new File([blob], storedFile.fileName, {
          type: storedFile.fileType,
          lastModified: storedFile.lastModified,
        });

        console.log('✅ File retrieved from IndexedDB:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(file);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve file from IndexedDB'));
      };
    });
  }

  /**
   * Check if a file exists in IndexedDB
   */
  async hasFile(id: string = 'current'): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to check file in IndexedDB'));
      };
    });
  }

  /**
   * Delete a file from IndexedDB
   */
  async deleteFile(id: string = 'current'): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ File deleted from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete file from IndexedDB'));
      };
    });
  }

  /**
   * Clear all files from IndexedDB
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🗑️ All files cleared from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear IndexedDB'));
      };
    });
  }

  /**
   * Get file metadata without loading the full file
   */
  async getFileMetadata(id: string = 'current'): Promise<Omit<StoredFile, 'fileData'> | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const storedFile = request.result as StoredFile | undefined;
        
        if (!storedFile) {
          resolve(null);
          return;
        }

        const { fileData, ...metadata } = storedFile;
        resolve(metadata);
      };

      request.onerror = () => {
        reject(new Error('Failed to get file metadata from IndexedDB'));
      };
    });
  }
}

// Singleton instance
let indexedDBServiceInstance: IndexedDBService | null = null;

export const getIndexedDBService = (): IndexedDBService => {
  if (!indexedDBServiceInstance) {
    indexedDBServiceInstance = new IndexedDBService();
  }
  return indexedDBServiceInstance;
};

