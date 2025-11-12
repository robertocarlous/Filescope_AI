'use client'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Upload, FileText, Database, CheckCircle, AlertCircle, 
  X, ArrowRight, BarChart3, Shield, Zap, 
  FileSpreadsheet, Code, Info, Loader, Eye,
  DollarSign, Cloud
} from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { analysisAPI } from '../../services/analysisApi';
import { fileStoreContract } from '../index';
import { FilecoinCloudService, getFilecoinCloudService } from '../../services/filecoinCloud';
import { PaymentSetupModal } from '../../components/PaymentSetupModal';
import { getIndexedDBService } from '../../services/indexedDB';

// Pinata IPFS configuration
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;
const PINATA_JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET;

interface FilePreview {
  headers: string[];
  sampleRows: string[][];
  totalLines: number;
}

interface SupportedType {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

interface SampleDataset {
  name: string;
  size: string;
  rows: string;
  description: string;
  type: string;
}

const FileScopeApp = () => {
  // Navigation state
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Upload states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  
  // Results states  
  const [isPublic, setIsPublic] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [priceInFIL, setPriceInFIL] = useState<string>('');

  // New state for tracking analysis data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [focPieceCid, setFocPieceCid] = useState<string | null>(null);

  // FOC service and payment setup
  const [focService, setFocService] = useState<FilecoinCloudService | null>(null);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [currentProcessingStep, setCurrentProcessingStep] = useState<string>('');
  const [pendingAnalysisId, setPendingAnalysisId] = useState<string | null>(null);

  // Wallet connection check
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Blockchain contract write hook
  const { writeContract, data: blockchainData, isPending: isBlockchainLoading, error: contractError, reset: resetContract } = useWriteContract();

  // Transaction receipt hook for confirmation
  const { data: transactionReceipt, isSuccess: isTransactionConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash: blockchainData as `0x${string}` | undefined,
  });

  // All memoized values MUST be called before any conditional logic
  // Supported file types
  const supportedTypes: Record<string, SupportedType> = useMemo(() => ({
    'text/csv': { icon: FileSpreadsheet, label: 'CSV', color: 'green' },
    'application/json': { icon: Code, label: 'JSON', color: 'blue' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileText, label: 'XLSX', color: 'orange' },
    'text/plain': { icon: FileText, label: 'TXT', color: 'gray' }
  }), []);

  // Sample datasets
  const sampleDatasets: SampleDataset[] = useMemo(() => [
    {
      name: "Election Polling Data 2024",
      size: "2.3 MB",
      rows: "15,420",
      description: "Comprehensive polling data from multiple sources",
      type: "CSV"
    },
    {
      name: "Climate Temperature Records",
      size: "8.7 MB", 
      rows: "89,432",
      description: "Global temperature data over the past 50 years",
      type: "JSON"
    }
  ], []);

  // ALL useCallback functions MUST be called before any conditional logic
  // Function to clear saved state
  const clearSavedState = useCallback(async () => {
    sessionStorage.removeItem('uploadState');
    try {
      const dbService = getIndexedDBService();
      await dbService.deleteFile();
      console.log('🗑️ Cleared saved state and IndexedDB');
    } catch (error) {
      console.error('⚠️ Failed to clear IndexedDB:', error);
      // Continue anyway
    }
  }, []);

  // Function to save current state to sessionStorage
  const saveState = useCallback(() => {
    const state = {
      currentStep,
      analysisProgress,
      currentAnalysisId,
      fileName: uploadedFile?.name,
      fileSize: uploadedFile?.size,
      fileType: uploadedFile?.type,
      isPublic,
      isPaid,
      priceInFIL
    };
    sessionStorage.setItem('uploadState', JSON.stringify(state));
    console.log('💾 Saved state to sessionStorage:', state);
  }, [currentStep, analysisProgress, currentAnalysisId, uploadedFile, isPublic, isPaid, priceInFIL]);

  // IPFS Upload Function using Pinata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadToIPFS = useCallback(async (file: File, analysisResults: any) => {
    try {
      console.log('🌐 Starting IPFS upload...');
      
      // Create metadata for IPFS
      const metadata = {
        name: file.name,
        description: `AI Analysis Results for ${file.name}`,
        image: null,
        attributes: [
          {
            trait_type: "File Type",
            value: file.type
          },
          {
            trait_type: "File Size",
            value: `${(file.size / 1024).toFixed(2)} KB`
          },
          {
            trait_type: "Quality Score",
            value: analysisResults.qualityScore?.overall || 0
          },
          {
            trait_type: "Anomalies Found",
            value: analysisResults.anomalies?.total || 0
          },
          {
            trait_type: "Analysis Date",
            value: new Date().toISOString()
          }
        ]
      };

      // Upload metadata to IPFS
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', metadataFile);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PINATA_JWT_SECRET}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const hash = result.IpfsHash;
      
      console.log('✅ IPFS upload successful:', hash);
      return hash;
    } catch (error) {
      console.error('❌ IPFS upload failed:', error);
      throw new Error(`Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Navigation Functions
  const navigateToStep = useCallback((step: 'upload' | 'preview' | 'processing') => {
    setCurrentStep(step);
    if (step === 'upload') {
      // Inline reset logic to avoid dependency issues
      setUploadedFile(null);
      setFilePreview(null);
      setError(null);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setCurrentAnalysisId(null);
      setIsPublic(false);
      setAnalysisResults(null);
      setIpfsHash(null);
      resetContract();
    }
  }, [resetContract]);

  const resetUpload = useCallback(async () => {
    setUploadedFile(null);
    setFilePreview(null);
    setError(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setCurrentAnalysisId(null);
    setIsPublic(false);
    setAnalysisResults(null);
    setIpfsHash(null);
    resetContract();
    
    // Clear IndexedDB
    try {
      const dbService = getIndexedDBService();
      await dbService.deleteFile();
      console.log('🗑️ Cleared IndexedDB on reset');
    } catch (error) {
      console.error('⚠️ Failed to clear IndexedDB:', error);
    }
  }, [resetContract]);

  // File Upload Functions
  const generatePreview = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      let preview: FilePreview = { headers: [], sampleRows: [], totalLines: 0 };
      
      if (file.type === 'text/csv') {
        const lines = content.split('\n');
        preview = {
          headers: lines[0] ? lines[0].split(',').map((h: string) => h.trim()) : [],
          sampleRows: lines.slice(1, 6).map((row: string) => row.split(',')),
          totalLines: lines.length - 1
        };
      }
      
      setFilePreview(preview);
    };
    
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null);
    
    if (!supportedTypes[file.type]) {
      const errorMsg = `Unsupported file type: ${file.type}. Please upload CSV, JSON, Excel, or text files.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      const errorMsg = 'File size too large. Please upload files smaller than 100MB.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Store file in IndexedDB for persistence
    try {
      const dbService = getIndexedDBService();
      await dbService.storeFile(file);
      console.log('✅ File stored in IndexedDB');
    } catch (error) {
      console.error('⚠️ Failed to store file in IndexedDB:', error);
      // Continue anyway - IndexedDB is optional for persistence
    }

    setUploadedFile(file);
    generatePreview(file);
    setCurrentStep('preview');
    toast.success('File uploaded successfully! Review your data below.');
  }, [supportedTypes, generatePreview]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const handleSampleDataset = useCallback((dataset: SampleDataset) => {
    const csvContent = `poll_date,candidate,party,percentage,sample_size,location
2024-07-15,John Smith,Democratic,42.3,1200,California
2024-07-15,Jane Doe,Republican,38.7,1200,California
2024-07-16,John Smith,Democratic,41.8,950,Texas
2024-07-16,Jane Doe,Republican,39.2,950,Texas
2024-07-17,John Smith,Democratic,43.1,1100,New York
2024-07-17,Jane Doe,Republican,37.9,1100,New York`;
    
    const mockFile = new File(
      [csvContent], 
      dataset.name.toLowerCase().replace(/\s+/g, '_') + '.csv',
      { type: 'text/csv' }
    );
    setUploadedFile(mockFile);
    
    setFilePreview({
      headers: ['poll_date', 'candidate', 'party', 'percentage', 'sample_size', 'location'],
      sampleRows: [
        ['2024-07-15', 'John Smith', 'Democratic', '42.3', '1200', 'California'],
        ['2024-07-15', 'Jane Doe', 'Republican', '38.7', '1200', 'California'],
        ['2024-07-16', 'John Smith', 'Democratic', '41.8', '950', 'Texas'],
        ['2024-07-16', 'Jane Doe', 'Republican', '39.2', '950', 'Texas']
      ],
      totalLines: parseInt(dataset.rows.replace(',', ''))
    });
    
    setCurrentStep('preview');
    toast.success(`Using sample dataset: ${dataset.name}`);
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Function to continue monitoring analysis (used for both new and restored sessions)
  const continueAnalysisMonitoring = useCallback(async (analysisId: string) => {
    try {
      // Check if we already have results in state (from restoration)
      let completedAnalysis;
      let frontendResults;
      
      if (analysisResults) {
        // We already have results, skip analysis waiting
        console.log('✅ Using existing analysis results, skipping wait');
        frontendResults = analysisResults;
        setCurrentProcessingStep('Processing analysis results...');
        setAnalysisProgress(70);
      } else {
        // Step 2: Wait for analysis completion with real progress updates
        setCurrentProcessingStep('Running AI analysis...');
        setAnalysisProgress(10);
        toast.loading('AI analysis in progress...', { id: 'analysis' });
        saveState();
        
        completedAnalysis = await analysisAPI.waitForAnalysisCompletion(
          analysisId,
          (status, progress) => {
            // Map backend progress (0-100) to our progress range (10-70)
            const mappedProgress = 10 + (progress || 0) * 0.6;
            setAnalysisProgress(mappedProgress);
            setCurrentProcessingStep(`Analyzing dataset... ${Math.round(progress || 0)}%`);
            saveState(); // Save progress
            if (status === 'processing') {
              toast.loading(`AI analysis in progress... ${Math.round(progress || 0)}%`, { id: 'analysis' });
            } else if (status === 'pending') {
              toast.loading('Analysis queued...', { id: 'analysis' });
            }
          }
        );
        
        // Step 3: Convert backend format to frontend format
        setCurrentProcessingStep('Processing analysis results...');
        setAnalysisProgress(70);
        frontendResults = analysisAPI.convertToFrontendFormat(completedAnalysis);
      }
      
      // Log the full backend response to see what we're getting
      if (completedAnalysis) {
        console.log('🔍 Full Backend API Response:', completedAnalysis);
      }
      console.log('📊 Converted Frontend Results:', frontendResults);
      
      setAnalysisResults(frontendResults); // Store results in state
      
      // Step 4: Upload dataset to storage (FOC for paid, IPFS for free)
      let datasetCID: string;
      
      if (isPaid && priceInFIL && parseFloat(priceInFIL) > 0) {
        // Paid dataset: Upload to FOC
        if (!focService) {
          throw new Error('FOC service not initialized');
        }

        // Validate file before upload - ensure it's a real file, not a mock from state restoration
        if (!uploadedFile) {
          throw new Error('File not found. The file may have been lost. Please upload your file again.');
        }
        
        // Check if file is a mock file (created from sessionStorage restoration)
        // Mock files have size 0 and no actual content - they cannot be used for FOC upload
        if (uploadedFile.size === 0) {
          console.error('❌ File validation failed: File size is 0. This is likely a mock file from state restoration.');
          throw new Error('File appears to be empty or lost. Please refresh the page and upload your file again. Note: If you refreshed the page, you will need to re-upload your file as File objects cannot be restored from browser storage.');
        }

        setCurrentProcessingStep('Uploading to Filecoin Onchain Cloud...');
        setAnalysisProgress(75);
        toast.loading('Uploading to Filecoin Onchain Cloud...', { id: 'analysis' });
        saveState();

        // Try to retrieve file from IndexedDB if current file is empty/mock
        let fileToUpload = uploadedFile;
        if (!uploadedFile || uploadedFile.size === 0) {
          console.log('⚠️ File is empty or missing, attempting to retrieve from IndexedDB...');
          const dbService = getIndexedDBService();
          const storedFile = await dbService.getFile();
          
          if (storedFile && storedFile.size > 0) {
            console.log('✅ Retrieved file from IndexedDB:', storedFile.name, `(${(storedFile.size / 1024 / 1024).toFixed(2)} MB)`);
            fileToUpload = storedFile;
            setUploadedFile(storedFile);
          } else {
            throw new Error('File not found. Please upload your file again.');
          }
        }

        // Upload to FOC - ensure file is properly passed
        console.log('📤 Uploading file to FOC:', {
          name: fileToUpload.name,
          size: fileToUpload.size,
          sizeMB: (fileToUpload.size / 1024 / 1024).toFixed(2),
          type: fileToUpload.type,
          lastModified: fileToUpload.lastModified
        });

        // Verify file is still accessible
        if (!fileToUpload.size || fileToUpload.size === 0) {
          throw new Error('File appears to be empty. Please try uploading again.');
        }

        const focResult = await focService.uploadDataset(fileToUpload, {
          app: 'filescope-ai',
          datasetName: fileToUpload.name,
          uploadedBy: address || '',
          isPaid: 'true',
          priceInFIL: priceInFIL,
        });
        
        datasetCID = focResult.pieceCid;
        setFocPieceCid(focResult.pieceCid);
        setAnalysisProgress(80);
        toast.success('Dataset uploaded to FOC!', { id: 'analysis' });
      } else {
        // Free dataset: Upload to IPFS
        setCurrentProcessingStep('Uploading to IPFS...');
        setAnalysisProgress(75);
        toast.loading('Storing results on IPFS...', { id: 'analysis' });
        saveState();
        
        // Try to retrieve file from IndexedDB if current file is empty/mock
        let fileToUpload = uploadedFile;
        if (!uploadedFile || uploadedFile.size === 0) {
          console.log('⚠️ File is empty or missing, attempting to retrieve from IndexedDB...');
          const dbService = getIndexedDBService();
          const storedFile = await dbService.getFile();
          
          if (storedFile && storedFile.size > 0) {
            console.log('✅ Retrieved file from IndexedDB for IPFS upload:', storedFile.name);
            fileToUpload = storedFile;
            setUploadedFile(storedFile);
          } else {
            throw new Error('File not found. Please upload your file again.');
          }
        }
        
        datasetCID = await uploadToIPFS(fileToUpload!, frontendResults);
        setIpfsHash(datasetCID);
        setAnalysisProgress(80);
      }

      // Step 5: Upload analysis results to IPFS (always)
      setCurrentProcessingStep('Storing analysis results...');
      setAnalysisProgress(85);
      toast.loading('Storing analysis results on IPFS...', { id: 'analysis' });
      saveState();
      
      // Use the same file we used for dataset upload (either from state or IndexedDB)
      let fileForAnalysis = uploadedFile;
      if (!fileForAnalysis || fileForAnalysis.size === 0) {
        const dbService = getIndexedDBService();
        const storedFile = await dbService.getFile();
        if (storedFile && storedFile.size > 0) {
          fileForAnalysis = storedFile;
        }
      }
      
      if (!fileForAnalysis || fileForAnalysis.size === 0) {
        throw new Error('File not available for analysis upload. Please try again.');
      }
      
      const analysisCID = await uploadToIPFS(fileForAnalysis, frontendResults);
      
      // Step 6: Register on Blockchain
      setCurrentProcessingStep('Registering on blockchain...');
      setAnalysisProgress(90);
      toast.loading('Registering on blockchain...', { id: 'analysis' });
      saveState();
      
      if (!writeContract) {
        throw new Error('Blockchain upload function not available');
      }
      
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      // Convert price to wei (FIL has 18 decimals)
      const priceWei = isPaid && priceInFIL 
        ? BigInt(Math.floor(parseFloat(priceInFIL) * 1e18))
        : BigInt(0);
      
      console.log('🔗 Calling smart contract...');
      console.log('Contract address:', fileStoreContract.address);
      console.log('Dataset CID:', datasetCID);
      console.log('Analysis CID:', analysisCID);
      console.log('Is public:', isPublic);
      console.log('Is private:', !isPublic);
      console.log('Is paid:', isPaid);
      console.log('Price in FIL:', priceInFIL);
      console.log('Price in wei:', priceWei.toString());
      
      // Call the smart contract with all parameters
      writeContract({
        address: fileStoreContract.address as `0x${string}`,
        abi: fileStoreContract.abi,
        functionName: 'uploadDataset',
        args: [
          datasetCID,           // datasetCID (FOC PieceCID or IPFS CID)
          analysisCID,          // analysisCID (IPFS CID)
          isPublic,             // isPublic
          !isPublic,            // isPrivate (inverse of isPublic for now)
          isPaid,               // isPaid
          priceWei,             // priceInFIL (in wei)
        ],
      });
      
      setCurrentProcessingStep('Waiting for transaction confirmation...');
      setAnalysisProgress(95);
      console.log('✅ Smart contract call initiated...');
      toast.loading('Waiting for wallet confirmation...', { id: 'analysis' });
      
      // The useEffect hook will handle navigation when transaction is confirmed
      
    } catch (error) {
      console.error('Analysis monitoring failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast.error(`Analysis monitoring failed: ${errorMessage}`, { id: 'analysis' });
      setCurrentStep('preview');
      setIsAnalyzing(false);
      setCurrentProcessingStep('');
      clearSavedState();
    }
  }, [uploadedFile, isPublic, isPaid, priceInFIL, address, focService, uploadToIPFS, writeContract, isConnected, saveState, clearSavedState]);

  const startAnalysis = useCallback(async () => {
    if (!uploadedFile) {
      toast.error('No file selected');
      return;
    }

    // Clear any existing saved state to prevent restoration from interfering
    clearSavedState();
    sessionStorage.removeItem('analysisResults');
    
    // Reset previous state
    setAnalysisResults(null);
    setIpfsHash(null);
    setFocPieceCid(null);
    resetContract();
    
    // Set processing step FIRST to ensure UI is visible
    console.log('🚀 Starting analysis - setting step to processing');
    setCurrentStep('processing');
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    // Set initial step based on whether it's a paid dataset
    if (isPaid && priceInFIL && parseFloat(priceInFIL) > 0) {
      setCurrentProcessingStep('Checking payment setup...');
    } else {
      setCurrentProcessingStep('Preparing upload...');
    }
    
    console.log('✅ Step set to processing, isAnalyzing:', true, 'currentStep should be:', 'processing');
    
    // Force a re-render to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Save state after UI has updated
    saveState();
    
    // Small delay to ensure UI updates before starting async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('📊 About to start analysis flow...');
    
    try {
      // Step 0: Check payment setup for paid datasets BEFORE starting analysis
      if (isPaid && priceInFIL && parseFloat(priceInFIL) > 0) {
        if (!focService) {
          throw new Error('FOC service not initialized. Please refresh the page.');
        }

        setCurrentProcessingStep('Checking payment setup...');
        setAnalysisProgress(2);
        setIsCheckingPayment(true);
        const paymentStatus = await focService.checkPaymentSetup();
        setIsCheckingPayment(false);

        if (paymentStatus.needsApproval || paymentStatus.needsDeposit) {
          // Clear any existing analysis ID since we haven't started analysis yet
          setCurrentAnalysisId(null);
          setPendingAnalysisId(null);
          setShowPaymentSetup(true);
          setCurrentStep('preview');
          setIsAnalyzing(false);
          setCurrentProcessingStep('');
          clearSavedState(); // Clear saved state since we're not starting analysis yet
          toast('Payment setup required before upload', { id: 'analysis', icon: 'ℹ️' });
          return; // Exit early - payment modal will handle continuation
        }
      }

      // Step 1: Upload file and start real AI analysis
      setCurrentProcessingStep('Uploading file to analysis server...');
      setAnalysisProgress(5);
      toast.loading('Uploading file and starting AI analysis...', { id: 'analysis' });
      
      const uploadResult = await analysisAPI.uploadAndAnalyze(uploadedFile, isPublic);
      const analysisId = uploadResult.analysis_id;
      const analysisIdStr = String(analysisId);
      setCurrentAnalysisId(typeof analysisId === 'string' ? parseInt(analysisId) : analysisId);
      
      toast.success(`Analysis started! ID: ${analysisId}`, { id: 'analysis' });
      
      // Continue with monitoring
      await continueAnalysisMonitoring(analysisIdStr);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      let errorMessage = 'Analysis failed. Please try again.';
      
      if (error instanceof Error) {
        console.log('🔍 Detailed error information:');
        console.log('- Error name:', error.name);
        console.log('- Error message:', error.message);
        console.log('- Error stack:', error.stack);
        
        if (error.message.includes('No file provided')) {
          errorMessage = 'Please select a valid file to analyze.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Analysis is taking longer than expected. Please check back later.';
        } else if (error.message.includes('IPFS')) {
          errorMessage = 'Failed to store results on IPFS. Please try again.';
        } else if (error.message.includes('Blockchain') || error.message.includes('Contract')) {
          errorMessage = 'Blockchain registration failed. Please check your wallet and try again.';
        } else if (error.message.includes('failed')) {
          const match = error.message.match(/Upload failed \((\d+)\): (.+)/);
          if (match) {
            const statusCode = match[1];
            const serverError = match[2];
            errorMessage = `Server error (${statusCode}): ${serverError}`;
          } else {
            errorMessage = `Server error: ${error.message}`;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, { id: 'analysis' });
      setCurrentStep('preview');
      setIsAnalyzing(false);
      setCurrentProcessingStep('');
      clearSavedState(); // Clear saved state on error
    }
  }, [uploadedFile, isPublic, isPaid, priceInFIL, focService, continueAnalysisMonitoring, saveState, clearSavedState, resetContract]);

  // ALL useEffect hooks MUST be called before any conditional logic
  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
    
    // Restore state from sessionStorage if available (only on mount)
    const savedState = sessionStorage.getItem('uploadState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.currentStep === 'processing') {
          console.log('🔄 Found processing state, attempting to restore...');
          
          // Check if we have analysis results already stored AND transaction is confirmed
          // Only navigate if everything is truly complete
          const existingResults = sessionStorage.getItem('analysisResults');
          if (existingResults) {
            try {
              const resultsData = JSON.parse(existingResults);
              // Only navigate if we have confirmed blockchain data
              if (resultsData.blockchainData && resultsData.blockchainData.status === 'confirmed') {
                console.log('✅ Found completed results with confirmed transaction, navigating to results page');
                clearSavedState();
                router.push('/results');
                return;
              } else {
                // Results exist but transaction not confirmed - clear and restart
                console.log('⚠️ Results exist but transaction not confirmed, clearing state');
                sessionStorage.removeItem('analysisResults');
              }
            } catch (e) {
              console.error('Failed to parse existing results:', e);
              sessionStorage.removeItem('analysisResults');
            }
          }
          
          // If no results but we have an analysis ID, we might be able to check status
          if (parsedState.currentAnalysisId) {
            console.log('🔍 Checking analysis status for ID:', parsedState.currentAnalysisId);
            
            // Check if analysis is complete
            analysisAPI.getAnalysisStatus(String(parsedState.currentAnalysisId))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((status: any) => {
                console.log('📊 Analysis status:', status);
                
                if (status.status === 'completed') {
                  console.log('🎉 Analysis already completed, but continuing with storage and blockchain registration...');
                  // Don't navigate immediately - continue with the full flow
                  // Restore the UI state and continue from where we left off
                  setCurrentStep('processing');
                  setAnalysisProgress(70); // Analysis is done, continue with storage
                  setCurrentAnalysisId(parsedState.currentAnalysisId);
                  setIsAnalyzing(true);
                  
                  // Convert results and set them in state
                  const frontendResults = analysisAPI.convertToFrontendFormat(status);
                  setAnalysisResults(frontendResults);
                  
                  // Restore file from IndexedDB if needed
                  const dbService = getIndexedDBService();
                  dbService.getFile()
                    .then((storedFile) => {
                      if (storedFile && storedFile.size > 0) {
                        console.log('✅ Restored file from IndexedDB:', storedFile.name);
                        setUploadedFile(storedFile);
                      } else if (parsedState.fileName) {
                        // Fallback to mock file if IndexedDB doesn't have it
                        console.log('⚠️ File not in IndexedDB, using mock file');
                        const mockFile = new File([''], parsedState.fileName, { 
                          type: parsedState.fileType || 'text/csv',
                          lastModified: Date.now()
                        });
                        setUploadedFile(mockFile);
                      }
                      
                      // Continue with storage and blockchain registration
                      // This will be handled by continueAnalysisMonitoring
                      // It will skip the analysis wait since we already have results
                      setTimeout(() => {
                        continueAnalysisMonitoring(String(parsedState.currentAnalysisId));
                      }, 100);
                    })
                    .catch((error) => {
                      console.error('⚠️ Failed to restore file from IndexedDB:', error);
                      // Continue anyway
                      setTimeout(() => {
                        continueAnalysisMonitoring(String(parsedState.currentAnalysisId));
                      }, 100);
                    });
                } else if (status.status === 'failed' || status.status === 'error') {
                  console.log('❌ Analysis failed, clearing state');
                  toast.error('Previous analysis failed. Please try again.');
                  clearSavedState();
                  setCurrentStep('upload');
                } else {
                  console.log('⏳ Analysis still in progress, restoring UI state');
                  // Restore the UI state for ongoing analysis
                  setCurrentStep('processing');
                  setAnalysisProgress(parsedState.analysisProgress || 0);
                  setCurrentAnalysisId(parsedState.currentAnalysisId);
                  setIsAnalyzing(true);
                  
                  // Try to restore file from IndexedDB
                  const dbService = getIndexedDBService();
                  dbService.getFile()
                    .then((storedFile) => {
                      if (storedFile && storedFile.size > 0) {
                        console.log('✅ Restored file from IndexedDB:', storedFile.name);
                        setUploadedFile(storedFile);
                      } else if (parsedState.fileName) {
                        // Fallback to mock file if IndexedDB doesn't have it
                        console.log('⚠️ File not in IndexedDB, using mock file');
                        const mockFile = new File([''], parsedState.fileName, { 
                          type: parsedState.fileType || 'text/csv',
                          lastModified: Date.now()
                        });
                        setUploadedFile(mockFile);
                      }
                      
                      // Continue monitoring the analysis - call it after state is restored
                      setTimeout(() => {
                        continueAnalysisMonitoring(String(parsedState.currentAnalysisId));
                      }, 100);
                    })
                    .catch((error) => {
                      console.error('⚠️ Failed to restore file from IndexedDB:', error);
                      if (parsedState.fileName) {
                        const mockFile = new File([''], parsedState.fileName, { 
                          type: parsedState.fileType || 'text/csv',
                          lastModified: Date.now()
                        });
                        setUploadedFile(mockFile);
                      }
                      setTimeout(() => {
                        continueAnalysisMonitoring(String(parsedState.currentAnalysisId));
                      }, 100);
                    });
                }
              })
              .catch(error => {
                console.error('❌ Failed to check analysis status:', error);
                toast.error('Failed to restore previous session. Starting fresh.');
                clearSavedState();
                setCurrentStep('upload');
              });
          } else {
            console.log('⚠️ No analysis ID found, clearing corrupted state');
            toast.error('Previous session corrupted. Starting fresh.');
            clearSavedState();
            setCurrentStep('upload');
          }
        } else {
          console.log('📝 Restored non-processing state');
          // Restore other states normally
          setCurrentStep(parsedState.currentStep || 'upload');
          setAnalysisProgress(parsedState.analysisProgress || 0);
          setCurrentAnalysisId(parsedState.currentAnalysisId);
          setIsAnalyzing(false);
          
          if (parsedState.fileName && parsedState.fileSize) {
            const mockFile = new File([''], parsedState.fileName, { 
              type: parsedState.fileType || 'text/csv',
              lastModified: Date.now()
            });
            setUploadedFile(mockFile);
          }
        }
      } catch (error) {
        console.error('❌ Failed to restore state:', error);
        sessionStorage.removeItem('uploadState');
        toast.error('Failed to restore previous session.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Check wallet connection on mount
  useEffect(() => {
    if (mounted && !isConnected) {
      toast.error('Please connect your wallet to use this feature', {
        duration: 4000,
        icon: '🔒',
      });
      router.push('/');
    }
  }, [isConnected, router, mounted]);

  // Initialize FOC service when wallet connects
  useEffect(() => {
    if (mounted && isConnected && window.ethereum && !focService) {
      const service = getFilecoinCloudService();
      service.initialize(window.ethereum)
        .then(() => {
          setFocService(service);
          console.log('✅ FOC service initialized');
        })
        .catch((error) => {
          console.error('❌ Failed to initialize FOC service:', error);
          toast.error('Failed to initialize Filecoin Cloud service');
        });
    }
  }, [mounted, isConnected, focService]);

  // Watch for transaction confirmation and navigate to results
  useEffect(() => {
    const hasDatasetHash = ipfsHash || focPieceCid;
    if (mounted && isTransactionConfirmed && transactionReceipt && analysisResults && hasDatasetHash && uploadedFile) {
      console.log('✅ Transaction confirmed! Preparing navigation to results...');
      
      // Store results in sessionStorage for the results page
      const resultsData = {
        results: analysisResults,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        analysisId: currentAnalysisId,
        timestamp: new Date().toISOString(),
        isPublic: isPublic,
        isPaid: isPaid,
        priceInFIL: priceInFIL,
        ipfsHash: ipfsHash,
        focPieceCid: focPieceCid,
        blockchainData: {
          transactionHash: blockchainData,
          blockNumber: transactionReceipt.blockNumber?.toString() || 'confirmed',
          gasUsed: transactionReceipt.gasUsed?.toString() || 'N/A',
          status: 'confirmed'
        }
      };
      
      sessionStorage.setItem('analysisResults', JSON.stringify(resultsData));
      
      // Update progress to 100%
      setAnalysisProgress(100);
      
      const visibilityMsg = isPublic 
        ? isPaid
          ? 'Paid dataset uploaded and confirmed on blockchain! 💰'
          : 'Analysis completed and confirmed on blockchain! 🌐'
        : 'Analysis completed and confirmed on blockchain! 🔒';
      toast.success(visibilityMsg, { id: 'analysis' });
      
      // Clear saved processing state and IndexedDB
      clearSavedState();
      
      // Also clear IndexedDB explicitly after successful upload
      const dbService = getIndexedDBService();
      dbService.deleteFile()
        .then(() => {
          console.log('🗑️ Cleared IndexedDB after successful upload');
        })
        .catch((error) => {
          console.error('⚠️ Failed to clear IndexedDB:', error);
        });
      
      // Navigate to results page after a short delay to show completion
      setTimeout(() => {
        console.log('🚀 Navigating to results page...');
        router.push('/results');
      }, 1000);
    }
  }, [mounted, isTransactionConfirmed, transactionReceipt, analysisResults, ipfsHash, focPieceCid, uploadedFile, currentAnalysisId, isPublic, isPaid, priceInFIL, blockchainData, router, clearSavedState]);

  // Watch for contract errors
  useEffect(() => {
    if (mounted && contractError) {
      console.error('Contract error:', contractError);
      toast.error(`Contract error: ${contractError.message}`, { id: 'analysis' });
      setIsAnalyzing(false);
      setCurrentStep('preview');
      clearSavedState();
    }
  }, [mounted, contractError, clearSavedState]);

  // Watch for receipt errors
  useEffect(() => {
    if (mounted && receiptError) {
      console.error('Receipt error:', receiptError);
      toast.error(`Transaction error: ${receiptError.message}`, { id: 'analysis' });
      setIsAnalyzing(false);
      setCurrentStep('preview');
      clearSavedState();
    }
  }, [mounted, receiptError, clearSavedState]);

  // Save state whenever progress changes during processing
  useEffect(() => {
    if (currentStep === 'processing' && isAnalyzing) {
      saveState();
    }
  }, [currentStep, analysisProgress, currentAnalysisId, isAnalyzing, saveState]);

  // Conditional rendering - but AFTER all hooks have been called
  const shouldShowContent = mounted && isConnected;

  // Render loading state while checking wallet connection
  if (!shouldShowContent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {!mounted ? 'Loading...' : 'Connecting Wallet...'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {!mounted 
                ? 'Please wait while we initialize the application.' 
                : 'Please connect your wallet to continue.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render different steps based on current state
  const renderContent = () => {
    if (currentStep === 'processing') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analyzing Your Dataset</h1>
              <p className="text-gray-600 dark:text-gray-300">Our AI is processing your data with advanced algorithms</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
                  <BarChart3 className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Processing {uploadedFile?.name}</h2>
                {currentProcessingStep && (
                  <p className="text-lg text-blue-600 dark:text-blue-400 mb-4 font-medium">
                    {currentProcessingStep}
                  </p>
                )}
                
                {/* Real Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-500" 
                    style={{width: `${analysisProgress}%`}}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{Math.round(analysisProgress)}% complete</span>
                  {currentAnalysisId && (
                    <span className="text-xs">
                      Analysis ID: {currentAnalysisId}
                    </span>
                  )}
                </div>
                {blockchainData && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Transaction: {blockchainData.slice(0, 10)}...{blockchainData.slice(-8)}
                  </p>
                )}
              </div>

              {/* Real Analysis Steps - Clear Step-by-Step Progress */}
              <div className="space-y-3 mb-8">
                {/* Step 1: Payment Setup (for paid datasets) */}
                {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 && (
                  <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                    analysisProgress >= 5
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                      : analysisProgress >= 2
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                    {analysisProgress >= 5 ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : analysisProgress >= 2 ? (
                      <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                    )}
                    <div className="flex-1">
                      <div className={`font-medium ${
                        analysisProgress >= 5 ? 'text-green-900 dark:text-green-100' : 
                        analysisProgress >= 2 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        Step 1: Payment Setup
                      </div>
                      <div className={`text-sm ${
                        analysisProgress >= 5 ? 'text-green-700 dark:text-green-300' : 
                        analysisProgress >= 2 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {currentProcessingStep && currentProcessingStep.includes('Checking payment') ? currentProcessingStep : 
                         analysisProgress >= 5 ? 'Payment setup verified' : 
                         'Verifying payment setup...'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: File Upload */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 10
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress >= 5
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 10 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress >= 5 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 10 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress >= 5 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Step {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 ? '2' : '1'}: File Upload
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 10 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress >= 5 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {currentProcessingStep && currentProcessingStep.includes('Uploading file') ? currentProcessingStep : 
                       analysisProgress >= 10 ? 'File uploaded to analysis server' : 
                       analysisProgress >= 5 ? 'Uploading file to analysis server...' : 
                       'Preparing upload...'}
                    </div>
                  </div>
                </div>

                {/* Step 3: AI Analysis */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 70
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress >= 10
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 70 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress >= 10 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 70 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress >= 10 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Step {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 ? '3' : '2'}: AI Analysis
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 70 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress >= 10 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {currentProcessingStep && (currentProcessingStep.includes('Analyzing') || currentProcessingStep.includes('Running AI'))
                        ? currentProcessingStep 
                        : analysisProgress >= 70 
                          ? 'Analysis complete - Quality metrics, anomalies, and bias detected' 
                          : analysisProgress >= 10 
                            ? 'Running comprehensive AI analysis...' 
                            : 'Waiting for analysis to start...'}
                    </div>
                  </div>
                </div>

                {/* Step 4: Dataset Storage (FOC for paid, IPFS for free) */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 80
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress >= 75
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 80 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress >= 75 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 80 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress >= 75 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Step {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 ? '4' : '3'}: Dataset Storage
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 80 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress >= 75 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {analysisProgress >= 80 
                        ? (isPaid 
                          ? `Dataset stored on Filecoin Onchain Cloud (PieceCID: ${focPieceCid ? focPieceCid.slice(0, 20) + '...' : 'N/A'})` 
                          : `Dataset stored on IPFS (CID: ${ipfsHash ? ipfsHash.slice(0, 20) + '...' : 'N/A'})`)
                        : analysisProgress >= 75 
                          ? (currentProcessingStep || (isPaid 
                            ? 'Uploading to Filecoin Onchain Cloud...' 
                            : 'Uploading to IPFS...'))
                          : (isPaid 
                            ? 'Waiting to upload to FOC...' 
                            : 'Waiting to upload to IPFS...')}
                    </div>
                  </div>
                </div>

                {/* Step 5: Analysis Results Storage */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 90
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress >= 85
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 90 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress >= 85 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 90 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress >= 85 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Step {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 ? '5' : '4'}: Analysis Results Storage
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 90 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress >= 85 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {currentProcessingStep && currentProcessingStep.includes('Storing analysis') 
                        ? currentProcessingStep 
                        : analysisProgress >= 90 
                          ? 'Analysis results stored on IPFS' 
                          : analysisProgress >= 85 
                            ? 'Storing analysis results on IPFS...' 
                            : 'Waiting to store analysis results...'}
                    </div>
                  </div>
                </div>

                {/* Step 6: Blockchain Registration */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 100
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress >= 95
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 100 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress >= 95 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 100 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress >= 95 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Step {isPaid && priceInFIL && parseFloat(priceInFIL) > 0 ? '6' : '5'}: Blockchain Registration
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 100 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress >= 95 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {currentProcessingStep && (currentProcessingStep.includes('Registering') || currentProcessingStep.includes('Waiting for transaction'))
                        ? currentProcessingStep 
                        : analysisProgress >= 100 
                          ? (isTransactionConfirmed 
                            ? 'Dataset registered and confirmed on blockchain!' 
                            : 'Dataset registered on blockchain') 
                          : analysisProgress >= 95 
                            ? 'Registering on Filecoin blockchain...' 
                            : 'Waiting for blockchain registration...'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time file info */}
              {uploadedFile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatFileSize(uploadedFile.size)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">File Size</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{filePreview?.totalLines?.toLocaleString() || '0'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Rows</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{filePreview?.headers?.length || '0'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Columns</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{supportedTypes[uploadedFile.type]?.label || 'Unknown'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Format</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Navigation & Recovery Buttons */}
              <div className="mt-6 space-y-4">
                {/* Show transaction status if we have blockchain data */}
                {analysisProgress > 95 && blockchainData && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Transaction submitted: {blockchainData.slice(0, 10)}...
                        {isTransactionConfirmed ? ' ✅ Confirmed!' : ' ⏳ Confirming...'}
                      </p>
                      {!isTransactionConfirmed && (
                        <button
                          onClick={() => {
                            clearSavedState();
                            router.push('/results');
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Continue to Results (if stuck)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Recovery options for stuck processing */}
                {isAnalyzing && analysisProgress < 95 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="text-center">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                        Analysis taking too long? 
                        {currentAnalysisId && (
                          <span className="block text-xs mt-1">
                            Analysis ID: {currentAnalysisId}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        {currentAnalysisId && (
                          <button
                            onClick={() => continueAnalysisMonitoring(String(currentAnalysisId))}
                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                          >
                            Retry Analysis Check
                          </button>
                        )}
                        <button
                          onClick={() => {
                            clearSavedState();
                            setCurrentStep('upload');
                            setIsAnalyzing(false);
                            setAnalysisProgress(0);
                            setCurrentAnalysisId(null);
                            toast.success('Restarted session. Please upload your file again.');
                          }}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          Start Over
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 'preview') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Review & Analyze</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Review your data preview and start the AI analysis process
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* File Header */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      {uploadedFile?.type && supportedTypes[uploadedFile.type] && (() => {
                        const IconComponent = supportedTypes[uploadedFile.type].icon;
                        return <IconComponent className="w-6 h-6 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{uploadedFile?.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(uploadedFile?.size || 0)}</span>
                        <span>•</span>
                        <span>{filePreview?.totalLines?.toLocaleString()} rows</span>
                        <span>•</span>
                        <span>{filePreview?.headers?.length} columns</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigateToStep('upload')} 
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Data Preview</h4>
                {filePreview && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          {filePreview.headers.slice(0, 6).map((header, index) => (
                            <th key={index} className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreview.sampleRows.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-700">
                            {row.slice(0, 6).map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                {String(cell).length > 30 ? String(cell).substring(0, 30) + '...' : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Analysis Options */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 border-t border-gray-200 dark:border-gray-600">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">AI Analysis Features</h4>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Anomaly Detection</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Bias Assessment</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Quality Scoring</span>
                  </div>
                </div>

              {/* Visibility Toggle */}
              <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isPublic 
                        ? 'bg-blue-50 dark:bg-blue-900/30' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}>
                      {isPublic ? (
                        <Eye className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {isPublic ? 'Public Dataset' : 'Private Dataset'}
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {isPublic 
                          ? 'Analysis will be visible to everyone in the explorer' 
                          : 'Analysis will only be visible to you'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsPublic(!isPublic);
                      // If making private, disable paid option (private datasets cannot be paid)
                      if (!isPublic) {
                        setIsPaid(false);
                        setPriceInFIL('');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isPublic ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Paid Dataset Toggle (only for public datasets) */}
              {isPublic && (
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isPaid 
                          ? 'bg-green-50 dark:bg-green-900/30' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}>
                        <DollarSign className={`w-5 h-5 ${
                          isPaid ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          Monetize Dataset
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isPaid 
                            ? 'Users will pay to download this dataset. Stored on Filecoin Onchain Cloud with verifiable proofs.' 
                            : 'Make this dataset available for purchase. Requires FOC payment setup.'
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsPaid(!isPaid);
                        if (!isPaid) {
                          setPriceInFIL('');
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                        isPaid ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isPaid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {isPaid && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Price (FIL)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={priceInFIL}
                          onChange={(e) => setPriceInFIL(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Set the price buyers will pay to download this dataset
                        </p>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <Cloud className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-green-800 dark:text-green-200">
                            <p className="font-medium mb-1">Filecoin Onchain Cloud Storage</p>
                            <p className="text-xs">
                              Paid datasets are stored on FOC with verifiable proofs, CDN access, and programmable payments.
                              {!focService && ' Payment setup required before upload.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Info className="w-4 h-4" />
                    <span>Analysis will be stored permanently on Filecoin</span>
                  </div>
                  <button 
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{isAnalyzing ? 'Starting Analysis...' : 'Start AI Analysis'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default: Upload step
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Upload Your Dataset</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Upload any CSV, JSON, Excel, or text file to get instant AI-powered analysis with complete transparency on Filecoin
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Upload Area */}
            <div>
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {dragActive ? 'Drop your file here' : 'Drag & drop your dataset'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-8">
                  or <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
                  >
                    browse files
                  </button>
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.xlsx,.xls,.txt"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />

                <div className="flex justify-center space-x-6 mb-8">
                  {Object.entries(supportedTypes).map(([type, config]) => (
                    <div key={type} className="flex items-center space-x-2">
                      <config.icon className={`w-5 h-5 text-${config.color}-600`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Maximum file size: 100MB
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Sample Datasets */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Or try a sample dataset</h3>
              <div className="space-y-4">
                {sampleDatasets.map((dataset, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">{dataset.name}</h4>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{dataset.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{dataset.size}</span>
                          <span>•</span>
                          <span>{dataset.rows} rows</span>
                          <span>•</span>
                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{dataset.type}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleSampleDataset(dataset)}
                        className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Use Sample
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      
      {/* Payment Setup Modal */}
      {focService && (
        <PaymentSetupModal
          isOpen={showPaymentSetup}
          onClose={() => {
            setShowPaymentSetup(false);
            setIsAnalyzing(false);
            setCurrentStep('preview');
          }}
          onComplete={async () => {
            setShowPaymentSetup(false);
            // Restart the analysis flow after payment setup
            if (uploadedFile && uploadedFile.size > 0) {
              // Clear any stale state
              setCurrentAnalysisId(null);
              setPendingAnalysisId(null);
              // Payment is now set up, start the analysis from scratch
              // Use setTimeout to ensure modal closes before starting analysis
              setTimeout(() => {
                startAnalysis();
              }, 100);
            } else {
              toast.error('File not found. Please upload your file again.');
              setCurrentStep('upload');
            }
          }}
          focService={focService}
        />
      )}
    </>
  );
};

export default FileScopeApp;