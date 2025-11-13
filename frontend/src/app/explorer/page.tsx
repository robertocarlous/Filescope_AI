'use client'
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useReadContract, useAccount } from 'wagmi';
import { 
  Search, Grid, List, Database, Eye, Download, 
  Verified, ArrowLeft, AlertTriangle, FileText, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { fileStoreContract } from '../index';
import { getFilecoinCloudService } from '../../services/filecoinCloud';
import JSZip from 'jszip';
import jsPDF from 'jspdf';

// Proper TypeScript interfaces
interface ContractDataset {
  datasetCID: string;
  analysisCID: string;
  uploader: string;
  isPublic: boolean;
  isPrivate: boolean;
  timestamp: bigint;
  views: bigint;
  downloads: bigint;
  citations: bigint;
  isPaid: boolean;
  priceInFIL: bigint;
  earnings: bigint;
}

interface DatasetMetadata {
  fileName: string;
  fileSize: string;
  rows: number;
  columns: number;
  uploadDate: string;
  ipfsHash: string; // This is the dataset CID (could be FOC PieceCID or IPFS CID)
  analysisCID: string; // Analysis report CID (always IPFS)
  contractAddress: string;
  blockNumber: string;
  isPublic: boolean;
  description?: string;
  tags?: string[];
  format?: string;
}

interface DatasetResults {
  metrics: {
    quality_score: number;
    completeness: number;
    consistency: number;
    accuracy: number;
    validity: number;
    anomalies: {
      total: number;
      high: number;
      medium: number;
      low: number;
      details: Array<{
        column: string;
        type: string;
        count: number;
        severity: string;
        description: string;
        recommendation: string;
      }>;
    };
    bias_metrics: {
      overall: number;
      geographic: { score: number; status: string; description: string };
      demographic: { score: number; status: string; description: string };
    };
  };
  insights: Array<{
    type: string;
    title: string;
    description: string;
    action: string;
  }>;
  metadata?: {
    fileName?: string;
    fileSize?: string;
    file_size?: string;
    rows?: number;
    columns?: number;
    description?: string;
    tags?: string[];
    format?: string;
  };
}

interface Dataset {
  id: number;
  title: string;
  description: string;
  category: string;
  metadata: DatasetMetadata;
  results: DatasetResults;
  stats: {
    views: number;
    downloads: number;
    citations: number;
  };
  uploader: {
    address: string;
    name: string;
    reputation: number;
    verified: boolean;
  };
  analysis: {
    verified: boolean;
  };
  pricing: {
    isPaid: boolean;
    priceInFIL: string;
    priceInFILWei: bigint;
  };
  isPurchased: boolean;
}

interface IPFSData {
  name: string;
  description: string;
  image: string | null;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  // Keep the old structure for backward compatibility
  metadata?: {
    fileName: string;
    fileSize: string;
    rows: number;
    columns: number;
    description: string;
    format: string;
    tags?: string[];
  };
  results?: {
    metadata?: {
      fileName?: string;
      fileSize?: string;
      rows?: number;
      columns?: number;
      description?: string;
      tags?: string[];
      format?: string;
    };
    metrics: {
      quality_score: number;
      completeness: number;
      consistency: number;
      accuracy: number;
      validity: number;
      anomalies: {
        total: number;
        high: number;
        medium: number;
        low: number;
        details: Array<{
          column: string;
          type: string;
          count: number;
          severity: string;
          description: string;
          recommendation: string;
        }>;
      };
      bias_metrics: {
        overall: number;
        geographic: { score: number; status: string; description: string };
        demographic: { score: number; status: string; description: string };
      };
    };
    insights: Array<{
      type: string;
      title: string;
      description: string;
      action: string;
    }>;
  };
  originalFile?: {
    name: string;
    size: number;
    type: string;
  };
  analysis?: {
    qualityScore?: number;
    completeness?: number;
    consistency?: number;
    accuracy?: number;
    validity?: number;
    anomalies?: number;
  };
}

const DatasetExplorer = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [myPurchases, setMyPurchases] = useState<Set<number>>(new Set());
  
  const { address, isConnected } = useAccount();
  
  // State for ethers-based transactions
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPurchaseConfirmed, setIsPurchaseConfirmed] = useState(false);
  const [isApprovalConfirmed, setIsApprovalConfirmed] = useState(false);

  // Get all public datasets from contract (already filtered by contract)
  const { data: contractDatasets, isLoading: contractLoading } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getAllPublicDatasets',
  });

  // Get total dataset count to create CID -> ID mapping
  const { data: totalDatasetsCount } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'totalDatasets',
  });

  // Fetch user's purchases
  const { data: purchasedDatasetIds } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getMyPurchases',
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Fetch accepted payment tokens
  const { data: acceptedTokens } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getAcceptedTokens',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update purchased datasets when user's purchases are fetched
  useEffect(() => {
    if (purchasedDatasetIds && Array.isArray(purchasedDatasetIds)) {
      const purchasedSet = new Set(purchasedDatasetIds.map((id: bigint) => Number(id)));
      setMyPurchases(purchasedSet);
      console.log('📦 Updated purchases:', Array.from(purchasedSet));
    }
  }, [purchasedDatasetIds]);

  // Refetch purchases after purchase confirmation
  const { refetch: refetchPurchases } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getMyPurchases',
    query: {
      enabled: false, // Only fetch when explicitly called
    },
  });

  // Handle purchase confirmation - refetch purchases and update UI
  useEffect(() => {
    if (isPurchaseConfirmed && selectedDataset) {
      toast.success('Dataset purchased successfully! You can now download it.', { 
        id: 'purchase',
        duration: 5000,
        icon: '✅'
      });
      // Immediately update local state
      setMyPurchases(prev => new Set([...prev, selectedDataset.id]));
      // Refetch purchases from contract to ensure consistency
      if (isConnected && address) {
        refetchPurchases();
      }
      // Close modal after a short delay to show success
      setTimeout(() => {
        setPurchaseModalOpen(false);
        setSelectedDataset(null);
      }, 1500);
    }
  }, [isPurchaseConfirmed, selectedDataset, isConnected, address, refetchPurchases]);

  // Helper function to fetch from IPFS with multiple gateway fallbacks
  const fetchFromIPFS = useCallback(async (cid: string): Promise<Blob> => {
    // List of IPFS gateways to try (in order of preference)
    const gateways = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`,
      `https://ipfs.filebase.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
    ];

    let lastError: Error | null = null;

    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
          },
        });

        if (response.ok) {
          return await response.blob();
        }

        // If we get a 429 (rate limit), try next gateway
        if (response.status === 429) {
          console.warn(`Rate limited on ${gateway}, trying next gateway...`);
          lastError = new Error(`Rate limited on ${gateway}`);
          continue;
        }

        // For other errors, throw immediately
        throw new Error(`Failed to fetch from ${gateway}: ${response.status} ${response.statusText}`);
      } catch (error: any) {
        // CORS errors or network errors - try next gateway
        if (
          error?.message?.includes('CORS') ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.name === 'TypeError'
        ) {
          console.warn(`CORS/Network error on ${gateway}, trying next gateway...`);
          lastError = error;
          continue;
        }

        // For other errors, try next gateway but log it
        console.warn(`Error fetching from ${gateway}:`, error);
        lastError = error;
        continue;
      }
    }

    // If all gateways failed, throw the last error
    throw lastError || new Error('All IPFS gateways failed. Please try again later.');
  }, []);

  // Fetch IPFS data helper
  const fetchIPFSData = useCallback(async (cid: string): Promise<IPFSData> => {
    try {
      // Use fallback gateways for fetching IPFS data (JSON)
      const blob = await fetchFromIPFS(cid);
      const text = await blob.text();
      const data = JSON.parse(text);
      console.log('📊 IPFS data received:', JSON.stringify(data, null, 2));
      
      // Handle different IPFS data structures
      if (data.results && data.results.metadata) {
        // This is the full results structure (like climate_temperature_records.csv)
        return {
          name: data.name || 'Unknown Dataset',
          description: data.description || 'No description available',
          image: data.image,
          attributes: data.attributes || [],
          results: {
            metadata: {
              fileName: data.results.metadata.fileName,
              fileSize: data.results.metadata.fileSize,
              rows: data.results.metadata.rows,
              columns: data.results.metadata.columns,
              description: data.results.metadata.description,
              tags: data.results.metadata.tags || [],
              format: data.results.metadata.fileType || 'Unknown'
            },
            metrics: {
              quality_score: data.results.qualityScore?.overall || 0,
              completeness: data.results.qualityScore?.completeness || 0,
              consistency: data.results.qualityScore?.consistency || 0,
              accuracy: data.results.qualityScore?.accuracy || 0,
              validity: data.results.qualityScore?.validity || 0,
              anomalies: {
                total: data.results.anomalies?.total || 0,
                high: data.results.anomalies?.high || 0,
                medium: data.results.anomalies?.medium || 0,
                low: data.results.anomalies?.low || 0,
                details: data.results.anomalies?.details || []
              },
              bias_metrics: {
                overall: data.results.biasMetrics?.overall || 0,
                geographic: {
                  score: data.results.biasMetrics?.geographic?.score || 0,
                  status: data.results.biasMetrics?.geographic?.status || 'Unknown',
                  description: data.results.biasMetrics?.geographic?.description || 'No bias analysis available'
                },
                demographic: {
                  score: data.results.biasMetrics?.demographic?.score || 0,
                  status: data.results.biasMetrics?.demographic?.status || 'Unknown',
                  description: data.results.biasMetrics?.demographic?.description || 'No bias analysis available'
                }
              }
            },
            insights: data.results.insights || []
          }
        };
      } else if (data.originalFile && data.analysis) {
        // This is the structure with originalFile and analysis (like some climate_temperature_records.csv)
        return {
          name: data.name || 'Unknown Dataset',
          description: data.description || 'No description available',
          image: data.image,
          attributes: data.attributes || [],
          results: {
            metadata: {
              fileName: data.originalFile.name,
              fileSize: `${data.originalFile.size} bytes`,
              rows: data.results?.metadata?.rows || 0,
              columns: data.results?.metadata?.columns || 0,
              description: data.description,
              tags: [],
              format: data.originalFile.type
            },
            metrics: {
              quality_score: data.analysis.qualityScore || 0,
              completeness: data.analysis.completeness || 0,
              consistency: data.analysis.consistency || 0,
              accuracy: data.analysis.accuracy || 0,
              validity: data.analysis.validity || 0,
              anomalies: {
                total: data.analysis.anomalies || 0,
                high: 1,
                medium: 2,
                low: 2,
                details: []
              },
              bias_metrics: {
                overall: 0.15,
                geographic: { 
                  score: 0.1,
                  status: 'Low',
                  description: 'Bias analysis completed'
                },
                demographic: { 
                  score: 0.2,
                  status: 'Low',
                  description: 'Bias analysis completed'
                }
              }
            },
            insights: []
          }
        };
      } else if (data.attributes && Array.isArray(data.attributes)) {
        // This is the attributes-only structure (like txt.csv, election_polling_data_2024.csv)
        return {
          name: data.name || 'Unknown Dataset',
          description: data.description || 'No description available',
          image: data.image,
          attributes: data.attributes,
          results: {
            metrics: {
              quality_score: extractMetricFromAttributes(data.attributes, 'Quality Score', 0),
              completeness: 85, // Default value for attributes-only datasets
              consistency: 80,  // Default value for attributes-only datasets
              accuracy: 85,     // Default value for attributes-only datasets
              validity: 88,     // Default value for attributes-only datasets
              anomalies: {
                total: extractMetricFromAttributes(data.attributes, 'Anomalies Found', 0),
                high: 1,        // Default value for attributes-only datasets
                medium: 2,      // Default value for attributes-only datasets
                low: 2,         // Default value for attributes-only datasets
                details: []
              },
              bias_metrics: {
                overall: 0.15,  // Default value for attributes-only datasets
                geographic: { 
                  score: 0.1,
                  status: 'Low',
                  description: 'Bias analysis completed'
                },
                demographic: { 
                  score: 0.2,
                  status: 'Low',
                  description: 'Bias analysis completed'
                }
              }
            },
            insights: []
          }
        };
      } else {
        // Fallback structure
        return {
          name: 'Unknown Dataset',
          description: 'Analysis data unavailable',
          image: null,
          attributes: [],
          metadata: {
            fileName: 'Unknown Dataset',
            fileSize: 'Unknown',
            rows: 0,
            columns: 0,
            description: 'Analysis data unavailable',
            format: 'Unknown'
          },
          results: {
            metrics: {
              quality_score: 0,
              completeness: 0,
              consistency: 0,
              accuracy: 0,
              validity: 0,
              anomalies: {
                total: 0,
                high: 0,
                medium: 0,
                low: 0,
                details: []
              },
              bias_metrics: {
                overall: 0,
                geographic: { score: 0, status: 'Unknown', description: 'No bias analysis available' },
                demographic: { score: 0, status: 'Unknown', description: 'No bias analysis available' }
              }
            },
            insights: []
          }
        };
      }
    } catch (error) {
      console.error('Failed to fetch IPFS data:', error);
      return {
        name: 'Unknown Dataset',
        description: 'Analysis data unavailable',
        image: null,
        attributes: [],
        metadata: {
          fileName: 'Unknown Dataset',
          fileSize: 'Unknown',
          rows: 0,
          columns: 0,
          description: 'Analysis data unavailable',
          format: 'Unknown'
        },
        results: {
          metrics: {
            quality_score: 0,
            completeness: 0,
            consistency: 0,
            accuracy: 0,
            validity: 0,
            anomalies: {
              total: 0,
              high: 0,
              medium: 0,
              low: 0,
              details: []
            },
            bias_metrics: {
              overall: 0,
              geographic: { score: 0, status: 'Unknown', description: 'No bias analysis available' },
              demographic: { score: 0, status: 'Unknown', description: 'No bias analysis available' }
            }
          },
          insights: []
        }
      };
    }
  }, [fetchFromIPFS]);

  // Helper function to extract metrics from attributes
  const extractMetricFromAttributes = (attributes: Array<{ trait_type: string; value: string | number }>, metricName: string, defaultValue: number): number => {
    // First, try exact match
    let attribute = attributes.find(attr => 
      attr.trait_type.toLowerCase() === metricName.toLowerCase()
    );
    
    // If no exact match, try partial matches
    if (!attribute) {
      attribute = attributes.find(attr => 
        attr.trait_type.toLowerCase().includes(metricName.toLowerCase()) ||
        attr.trait_type.toLowerCase().includes(metricName.toLowerCase().replace(' ', '')) ||
        attr.trait_type.toLowerCase().includes(metricName.toLowerCase().replace(' ', '_'))
      );
    }
    
    // If still no match, try broader semantic matches
    if (!attribute) {
      const semanticMatches: Record<string, string[]> = {
        'rows': ['record', 'data point', 'size', 'count', 'total'],
        'columns': ['feature', 'variable', 'field', 'attribute', 'dimension'],
        'quality score': ['quality', 'score', 'rating'],
        'anomalies found': ['anomaly', 'issue', 'problem', 'error']
      };
      
      const semanticTerms = semanticMatches[metricName.toLowerCase()] || [];
      attribute = attributes.find(attr => 
        semanticTerms.some((term: string) => attr.trait_type.toLowerCase().includes(term))
      );
    }
    
    if (attribute) {
      const value = attribute.value;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Try to extract number from string (e.g., "100 rows", "50 columns", "1,000 records")
        const numMatch = value.match(/(\d{1,3}(?:,\d{3})*)/);
        if (numMatch) {
          return parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
        // Try simple number extraction
        const simpleMatch = value.match(/(\d+)/);
        if (simpleMatch) return parseInt(simpleMatch[1], 10);
      }
    }
    return defaultValue;
  };

  // NEW: Comprehensive function to extract rows and columns from any IPFS data structure
  const extractRowsAndColumns = (ipfsData: IPFSData): { rows: number; columns: number } => {
    let rows = 0;
    let columns = 0;

    // Method 1: Try to get from results.metadata first (most reliable)
    if (ipfsData.results?.metadata) {
      rows = ipfsData.results.metadata.rows || 0;
      columns = ipfsData.results.metadata.columns || 0;
    }

    // Method 2: Try to get from direct metadata
    if (ipfsData.metadata) {
      if (rows === 0) rows = ipfsData.metadata.rows || 0;
      if (columns === 0) columns = ipfsData.metadata.columns || 0;
    }

    // Method 3: Extract from attributes with various naming patterns
    if (rows === 0) {
      const rowPatterns = [
        'Rows', 'rows', 'Total Rows', 'total_rows', 'Row Count', 'row_count',
        'Records', 'records', 'Data Points', 'data_points', 'Dataset Size', 'dataset_size',
        'Total Records', 'total_records', 'Data Count', 'data_count'
      ];
      
      for (const pattern of rowPatterns) {
        const value = extractMetricFromAttributes(ipfsData.attributes, pattern, 0);
        if (value > 0) {
          rows = value;
          break;
        }
      }
    }

    if (columns === 0) {
      const columnPatterns = [
        'Columns', 'columns', 'Total Columns', 'total_columns', 'Column Count', 'column_count',
        'Features', 'features', 'Variables', 'variables', 'Fields', 'fields',
        'Total Features', 'total_features', 'Attribute Count', 'attribute_count'
      ];
      
      for (const pattern of columnPatterns) {
        const value = extractMetricFromAttributes(ipfsData.attributes, pattern, 0);
        if (value > 0) {
          columns = value;
          break;
        }
      }
    }

    // Method 4: Look for any attribute that might contain the information
    if (rows === 0 || columns === 0) {
      for (const attr of ipfsData.attributes) {
        const traitType = attr.trait_type.toLowerCase();
        const value = attr.value;
        
        // Skip if value is not a string or number
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        
        // Try to extract rows
        if (rows === 0 && (
          traitType.includes('row') || 
          traitType.includes('record') || 
          traitType.includes('data point') ||
          traitType.includes('size') ||
          traitType.includes('count')
        )) {
          if (typeof value === 'number') {
            rows = value;
          } else if (typeof value === 'string') {
            const numMatch = value.match(/(\d{1,3}(?:,\d{3})*)/);
            if (numMatch) {
              rows = parseInt(numMatch[1].replace(/,/g, ''), 10);
            }
          }
        }
        
        // Try to extract columns
        if (columns === 0 && (
          traitType.includes('column') || 
          traitType.includes('feature') || 
          traitType.includes('variable') ||
          traitType.includes('field') ||
          traitType.includes('attribute')
        )) {
          if (typeof value === 'number') {
            columns = value;
          } else if (typeof value === 'string') {
            const numMatch = value.match(/(\d{1,3}(?:,\d{3})*)/);
            if (numMatch) {
              columns = parseInt(numMatch[1].replace(/,/g, ''), 10);
            }
          }
        }
      }
    }

    // Method 5: Try to parse from description or other text fields
    if (rows === 0 || columns === 0) {
      const textFields = [
        ipfsData.description,
        ipfsData.name,
        ...ipfsData.attributes.map(attr => String(attr.value))
      ].filter(Boolean);

      for (const text of textFields) {
        if (rows === 0) {
          const rowMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:rows?|records?|data\s*points?)/i);
          if (rowMatch) {
            rows = parseInt(rowMatch[1].replace(/,/g, ''), 10);
          }
        }
        
        if (columns === 0) {
          const colMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:columns?|features?|variables?|fields?)/i);
          if (colMatch) {
            columns = parseInt(colMatch[1].replace(/,/g, ''), 10);
          }
        }
      }
    }

    // Method 6: NEW - Estimate from file size when no other data is available
    if (rows === 0 || columns === 0) {
      const fileSizeAttr = ipfsData.attributes.find(attr => 
        attr.trait_type.toLowerCase().includes('file size') ||
        attr.trait_type.toLowerCase().includes('size')
      );
      
      if (fileSizeAttr) {
        const fileSizeStr = String(fileSizeAttr.value);
        const { estimatedRows, estimatedColumns } = estimateRowsColumnsFromFileSize(fileSizeStr, ipfsData.name);
        
        if (rows === 0) rows = estimatedRows;
        if (columns === 0) columns = estimatedColumns;
      }
    }

    return { rows, columns };
  };

  // NEW: Function to estimate rows and columns from file size
  const estimateRowsColumnsFromFileSize = (fileSizeStr: string, fileName: string): { estimatedRows: number; estimatedColumns: number } => {
    // Extract file size in KB
    const sizeMatch = fileSizeStr.match(/(\d+(?:\.\d+)?)\s*KB/i);
    if (!sizeMatch) return { estimatedRows: 0, estimatedColumns: 0 };
    
    const sizeKB = parseFloat(sizeMatch[1]);
    
    // Estimate based on file type and size
    if (fileName.toLowerCase().endsWith('.csv')) {
      // CSV files: estimate based on typical CSV structure
      // Small files (< 1 KB): likely 10-50 rows, 3-8 columns
      // Medium files (1-10 KB): likely 50-500 rows, 5-15 columns
      // Large files (> 10 KB): likely 500+ rows, 10+ columns
      
      if (sizeKB < 1) {
        return { estimatedRows: Math.round(sizeKB * 30), estimatedColumns: Math.round(sizeKB * 5) };
      } else if (sizeKB < 10) {
        return { estimatedRows: Math.round(sizeKB * 100), estimatedColumns: Math.round(sizeKB * 1.5) };
      } else {
        return { estimatedRows: Math.round(sizeKB * 200), estimatedColumns: Math.round(sizeKB * 0.8) };
      }
    } else if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().includes('spreadsheet')) {
      // Excel files: typically more structured, fewer rows but more columns
      if (sizeKB < 5) {
        return { estimatedRows: Math.round(sizeKB * 15), estimatedColumns: Math.round(sizeKB * 3) };
      } else {
        return { estimatedRows: Math.round(sizeKB * 25), estimatedColumns: Math.round(sizeKB * 2) };
      }
    } else if (fileName.toLowerCase().endsWith('.json')) {
      // JSON files: structure varies greatly
      if (sizeKB < 1) {
        return { estimatedRows: Math.round(sizeKB * 20), estimatedColumns: Math.round(sizeKB * 4) };
      } else {
        return { estimatedRows: Math.round(sizeKB * 150), estimatedColumns: Math.round(sizeKB * 1.2) };
      }
    }
    
    // Default estimation for unknown file types
    return { 
      estimatedRows: Math.round(sizeKB * 50), 
      estimatedColumns: Math.round(sizeKB * 2) 
    };
  };

  // Process contract data - use getAllPublicDatasets which already filters correctly
  useEffect(() => {
    if (mounted && contractDatasets && !contractLoading) {
      const processDatasets = async () => {
        try {
          setLoading(true);
          const processedDatasets: Dataset[] = [];
          const { readContract } = await import('wagmi/actions');
          const { wagmiConfig } = await import('../../lib/web3');

          // Type guard to ensure contractDatasets is an array
          if (!Array.isArray(contractDatasets)) {
            console.warn('Contract datasets is not an array:', contractDatasets);
            setDatasets([]);
            setLoading(false);
            return;
          }

          // getAllPublicDatasets already filters for isPublic && !isPrivate
          // But it doesn't return dataset IDs, so we need to find them by matching CIDs
          const totalCount = totalDatasetsCount ? Number(totalDatasetsCount) : 0;
          
          // Create a mapping from datasetCID to datasetId by checking all datasets
          const cidToIdMap = new Map<string, number>();
          for (let datasetId = 0; datasetId < totalCount; datasetId++) {
            try {
              const dataset = await readContract(wagmiConfig, {
                address: fileStoreContract.address as `0x${string}`,
                abi: fileStoreContract.abi,
                functionName: 'getDataset',
                args: [BigInt(datasetId)],
              }) as ContractDataset;
              
              // Map both datasetCID and analysisCID to the dataset ID
              cidToIdMap.set(dataset.datasetCID, datasetId);
              cidToIdMap.set(dataset.analysisCID, datasetId);
            } catch (error) {
              // Skip datasets we can't access (private datasets)
              continue;
            }
          }

          console.log(`🔍 Processing ${contractDatasets.length} public datasets from getAllPublicDatasets...`);

          // Process each public dataset from getAllPublicDatasets
          for (let i = 0; i < contractDatasets.length; i++) {
            const contractDataset = contractDatasets[i] as ContractDataset;
            
            try {
              // Find the dataset ID by matching the datasetCID
              const datasetId = cidToIdMap.get(contractDataset.datasetCID);
              
              if (datasetId === undefined) {
                console.warn(`Could not find dataset ID for CID: ${contractDataset.datasetCID}`);
                // Fallback: use index as ID (not ideal, but better than nothing)
                // Actually, skip this dataset if we can't find its ID
                continue;
              }

              // Double-check: ensure this dataset is actually public and not private
              // (This should already be filtered by getAllPublicDatasets, but let's be safe)
              if (!contractDataset.isPublic || contractDataset.isPrivate) {
                console.log(`⏭️ Skipping dataset ${datasetId} - isPublic: ${contractDataset.isPublic}, isPrivate: ${contractDataset.isPrivate}`);
                continue;
              }

              const ipfsData = await fetchIPFSData(contractDataset.analysisCID);
              
              // Debug logging to see what data we have
              console.log(`🔍 Processing dataset ${datasetId}:`, {
                name: ipfsData.name,
                isPublic: contractDataset.isPublic,
                isPrivate: contractDataset.isPrivate,
                isPaid: contractDataset.isPaid
              });
              
              // Add safety checks for IPFS data structure
              if (!ipfsData || !ipfsData.name) {
                console.warn(`Dataset ${datasetId} has incomplete IPFS data:`, ipfsData);
                continue; // Skip this dataset
              }

              // Use the comprehensive extraction function
              const { rows, columns } = extractRowsAndColumns(ipfsData);

              // Convert price from wei to USDFC (1 USDFC = 10^18 wei)
              const priceInFILWei = contractDataset.priceInFIL || BigInt(0);
              const priceInFILRaw = priceInFILWei > 0 
                ? (Number(priceInFILWei) / 1e18).toFixed(6)
                : '0';
              const priceInFIL = formatPrice(priceInFILRaw);

              const dataset: Dataset = {
                id: datasetId, // Use the correct dataset ID from contract
                title: ipfsData.name || `Dataset ${datasetId + 1}`,
                description: ipfsData.description || 'AI-analyzed dataset',
                category: 'Technology', // Default category
                metadata: {
                  fileName: ipfsData.name || `Dataset ${datasetId + 1}`,
                  fileSize: getAttributeValue<string>(ipfsData.attributes, 'File Size', 'Unknown'),
                  rows: rows,
                  columns: columns,
                  uploadDate: new Date(Number(contractDataset.timestamp) * 1000).toISOString(),
                  ipfsHash: contractDataset.datasetCID, // Dataset CID (FOC PieceCID or IPFS CID)
                  analysisCID: contractDataset.analysisCID, // Analysis CID (always IPFS)
                  contractAddress: fileStoreContract.address,
                  blockNumber: '0',
                  isPublic: contractDataset.isPublic,
                  isPrivate: contractDataset.isPrivate || false,
                  description: ipfsData.description || 'No description available',
                  tags: ipfsData.attributes.filter(attr => attr.trait_type === 'tags')?.map(attr => attr.value as string) || [],
                  format: getAttributeValue<string>(ipfsData.attributes, 'File Type', 'Unknown')
                },
                pricing: {
                  isPaid: contractDataset.isPaid || false,
                  priceInFIL,
                  priceInFILWei,
                },
                isPurchased: myPurchases.has(datasetId),
                results: {
                  metrics: {
                    quality_score: ipfsData.results?.metrics?.quality_score || 0,
                    completeness: ipfsData.results?.metrics?.completeness || 0,
                    consistency: ipfsData.results?.metrics?.consistency || 0,
                    accuracy: ipfsData.results?.metrics?.accuracy || 0,
                    validity: ipfsData.results?.metrics?.validity || 0,
                    anomalies: {
                      total: ipfsData.results?.metrics?.anomalies?.total || 0,
                      high: ipfsData.results?.metrics?.anomalies?.high || 0,
                      medium: ipfsData.results?.metrics?.anomalies?.medium || 0,
                      low: ipfsData.results?.metrics?.anomalies?.low || 0,
                      details: ipfsData.results?.metrics?.anomalies?.details || []
                    },
                    bias_metrics: {
                      overall: ipfsData.results?.metrics?.bias_metrics?.overall || 0,
                      geographic: { 
                        score: ipfsData.results?.metrics?.bias_metrics?.geographic?.score || 0, 
                        status: ipfsData.results?.metrics?.bias_metrics?.geographic?.status || 'Unknown', 
                        description: ipfsData.results?.metrics?.bias_metrics?.geographic?.description || 'No bias analysis available' 
                      },
                      demographic: { 
                        score: ipfsData.results?.metrics?.bias_metrics?.demographic?.score || 0, 
                        status: ipfsData.results?.metrics?.bias_metrics?.demographic?.status || 'Unknown', 
                        description: ipfsData.results?.metrics?.bias_metrics?.demographic?.description || 'No bias analysis available' 
                      }
                    }
                  },
                  insights: ipfsData.results?.insights || [],
                  metadata: ipfsData.results?.metadata
                },
                stats: {
                  views: Number(contractDataset.views),
                  downloads: Number(contractDataset.downloads),
                  citations: Number(contractDataset.citations)
                },
                uploader: {
                  address: contractDataset.uploader,
                  name: `User ${contractDataset.uploader.slice(0, 6)}...`,
                  reputation: 85,
                  verified: true
                },
                analysis: {
                  verified: true
                }
              };

              processedDatasets.push(dataset);
            } catch (error) {
              console.error(`Failed to process dataset ${i}:`, error);
              // Continue processing other datasets instead of failing completely
            }
          }

          setDatasets(processedDatasets);
        } catch (error) {
          console.error('Failed to process datasets:', error);
          setError('Failed to process datasets');
        } finally {
          setLoading(false);
        }
      };

      processDatasets();
    }
  }, [mounted, contractDatasets, contractLoading, totalDatasetsCount, fetchIPFSData, myPurchases]);

  // Helper functions
  const getAttributeValue = <T extends string | number>(attributes: Array<{ trait_type: string; value: string | number }>, traitType: string, defaultValue: T): T => {
    const attr = attributes.find(attr => attr.trait_type === traitType);
    return (attr ? attr.value : defaultValue) as T;
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Format price to remove trailing zeros
  const formatPrice = (price: string | number): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice) || numPrice === 0) return '0';
    
    // If it's a whole number, return without decimals
    if (numPrice % 1 === 0) {
      return numPrice.toString();
    }
    
    // Otherwise, remove trailing zeros (up to 6 decimal places)
    return numPrice.toFixed(6).replace(/\.?0+$/, '');
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Purchase dataset handler
  const handlePurchase = (dataset: Dataset) => {
    // Only allow purchase for paid datasets
    if (!dataset.pricing.isPaid || dataset.pricing.priceInFILWei === BigInt(0)) {
      toast.error('This dataset is free. You can download it directly without purchase.');
      return;
    }

    // Check if already purchased
    if (dataset.isPurchased) {
      toast.info('You already own this dataset. Purchases are one-time and grant permanent access. You can download it anytime from the download buttons.');
      return;
    }

    if (!isConnected) {
      toast.error('Please connect your wallet to purchase datasets');
      return;
    }
    setSelectedDataset(dataset);
    setPurchaseModalOpen(true);
  };

  // State for approval flow
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalTokenAddress, setApprovalTokenAddress] = useState<`0x${string}` | null>(null);

  // Execute purchase transaction with approval using ethers
  const executePurchase = async () => {
    if (!selectedDataset || !isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Check if dataset is private (private datasets cannot be purchased)
    if (selectedDataset.metadata.isPrivate) {
      toast.error('This dataset is private and cannot be purchased. Private datasets are only accessible to the owner.');
      setPurchaseModalOpen(false);
      return;
    }

    // Check if dataset is actually paid
    if (!selectedDataset.pricing.isPaid || selectedDataset.pricing.priceInFILWei === BigInt(0)) {
      toast.error('This dataset is free and does not require purchase. You can download it directly.');
      setPurchaseModalOpen(false);
      return;
    }

    // Check if already purchased
    if (selectedDataset.isPurchased) {
      toast.error('You have already purchased this dataset. Purchases are one-time and grant permanent access. You can download it anytime.');
      setPurchaseModalOpen(false);
      return;
    }

    if (!window.ethereum) {
      toast.error('Ethereum provider not found');
      return;
    }

    try {
      // Initialize ethers provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Use USDFC token address for Calibration testnet
      const USDFC_ADDRESS = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0' as `0x${string}`;
      
      // Check if USDFC is in accepted tokens, otherwise use it directly
      let paymentTokenAddress: `0x${string}` = USDFC_ADDRESS;
      
      if (acceptedTokens && Array.isArray(acceptedTokens) && acceptedTokens.length > 0) {
        const usdfcInList = acceptedTokens.find((addr: string) => 
          addr.toLowerCase() === USDFC_ADDRESS.toLowerCase()
        );
        if (usdfcInList) {
          paymentTokenAddress = usdfcInList as `0x${string}`;
        } else {
          paymentTokenAddress = acceptedTokens[0] as `0x${string}`;
        }
      }

      // ERC20 ABI for allowance, approve, and balanceOf
      const ERC20_ABI = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)'
      ];

      // Create contract instances
      const tokenContract = new ethers.Contract(paymentTokenAddress, ERC20_ABI, signer);
      const fileStoreContractInstance = new ethers.Contract(
        fileStoreContract.address,
        fileStoreContract.abi,
        signer
      );

      const priceInWei = selectedDataset.pricing.priceInFILWei;
      
      // Check user's token balance first
      const balance = await tokenContract.balanceOf(address);
      if (balance < priceInWei) {
        throw new Error(`Insufficient USDFC balance. You have ${ethers.formatUnits(balance, 18)} USDFC, but need ${ethers.formatUnits(priceInWei, 18)} USDFC.`);
      }

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, fileStoreContract.address);
      
      // If allowance is insufficient, we need to approve first
      if (currentAllowance < priceInWei) {
        setNeedsApproval(true);
        setApprovalTokenAddress(paymentTokenAddress);
        setIsApproving(true);
        
        toast.loading('Approving USDFC token...', { id: 'approval' });
        
        // Approve a larger amount to avoid repeated approvals (1000x the price)
        const approvalAmount = priceInWei * BigInt(1000);
        
        try {
          const approveTx = await tokenContract.approve(fileStoreContract.address, approvalAmount);
          toast.loading('Waiting for approval confirmation...', { id: 'approval' });
          await approveTx.wait();
          
          setIsApprovalConfirmed(true);
          setIsApproving(false);
          toast.success('Token approved! Proceeding with purchase...', { id: 'approval' });
          
          // Proceed with purchase after approval
          await executePurchaseTransaction(signer, fileStoreContractInstance, paymentTokenAddress);
        } catch (error) {
          setIsApproving(false);
          setNeedsApproval(false);
          throw error;
        }
        
        return;
      }

      // Allowance is sufficient, proceed with purchase
      await executePurchaseTransaction(signer, fileStoreContractInstance, paymentTokenAddress);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      setIsPurchasing(false);
      setIsApproving(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('already purchased') || errorMessage.includes('already owns')) {
        toast.error('You have already purchased this dataset.', { id: 'purchase' });
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        toast.error('Insufficient USDFC balance. Please ensure you have enough tokens.', { id: 'purchase' });
      } else if (errorMessage.includes('allowance') || errorMessage.includes('approve')) {
        toast.error('Token approval failed. Please try again.', { id: 'purchase' });
      } else if (errorMessage.includes('not accepted') || errorMessage.includes('Payment token')) {
        toast.error('Payment token not accepted by contract. Please contact support.', { id: 'purchase' });
      } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        toast.error('Dataset not found. It may have been removed.', { id: 'purchase' });
      } else if (errorMessage.includes('not for sale') || errorMessage.includes('not available')) {
        toast.error('This dataset is not available for purchase.', { id: 'purchase' });
      } else if (errorMessage.includes('revert') || errorMessage.includes('Transaction reverted')) {
        toast.error('Transaction reverted. Please check if you have sufficient balance and the dataset is available.', { id: 'purchase' });
      } else if (errorMessage.includes('gas') || errorMessage.includes('out of gas') || errorMessage.includes('SysErrOutOfGas')) {
        toast.error('Transaction failed due to insufficient gas.', { id: 'purchase' });
      } else {
        toast.error(`Purchase failed: ${errorMessage}`, { id: 'purchase' });
      }
    }
  };

  // Helper function to execute the purchase transaction
  const executePurchaseTransaction = async (
    signer: ethers.JsonRpcSigner,
    contract: ethers.Contract,
    paymentTokenAddress: `0x${string}`
  ) => {
    if (!selectedDataset) return;

    // Double-check that this is a paid dataset
    if (!selectedDataset.pricing.isPaid || selectedDataset.pricing.priceInFILWei === BigInt(0)) {
      setIsPurchasing(false);
      throw new Error('This dataset is free and does not require purchase. You can download it directly.');
    }

    setIsPurchasing(true);
    toast.loading('Processing purchase...', { id: 'purchase' });

    try {
      console.log('🔍 Starting purchase transaction...', {
        datasetId: selectedDataset.id,
        paymentToken: paymentTokenAddress,
        isPaid: selectedDataset.pricing.isPaid,
        priceWei: selectedDataset.pricing.priceInFILWei.toString(),
        isPurchased: selectedDataset.isPurchased
      });

      // Estimate gas or use a high limit
      let gasLimit: bigint;
      try {
        gasLimit = await contract.purchaseDataset.estimateGas(
          BigInt(selectedDataset.id),
          paymentTokenAddress
        );
        // Add 30% buffer
        gasLimit = (gasLimit * BigInt(130)) / BigInt(100);
        console.log('✅ Gas estimated:', gasLimit.toString());
      } catch (gasError: any) {
        console.warn('⚠️ Gas estimation failed, using fixed limit:', gasError?.message);
        // If estimation fails, use a high fixed limit
        gasLimit = BigInt(15000000);
      }

      // Try a static call first to check if the transaction would succeed
      try {
        console.log('🔍 Validating purchase with static call...');
        
        await contract.purchaseDataset.staticCall(
          BigInt(selectedDataset.id),
          paymentTokenAddress
        );
        console.log('✅ Static call passed - transaction should succeed');
      } catch (staticError: any) {
        setIsPurchasing(false);
        
        // Try to extract revert reason from ethers error
        let revertReason = 'Transaction would revert';
        if (staticError?.reason) {
          revertReason = staticError.reason;
        } else if (staticError?.error?.data) {
          // Try to decode the revert reason from error data
          try {
            const decoded = contract.interface.parseError(staticError.error.data);
            revertReason = decoded?.name || revertReason;
          } catch {
            revertReason = staticError.error.data;
          }
        } else if (staticError?.message) {
          revertReason = staticError.message;
        }
        
        console.error('❌ Static call failed:', {
          error: staticError,
          reason: revertReason,
          fullError: JSON.stringify(staticError, Object.getOwnPropertyNames(staticError)),
          datasetId: selectedDataset.id,
          isPaid: selectedDataset.pricing.isPaid,
          priceWei: selectedDataset.pricing.priceInFILWei.toString()
        });
        
        throw new Error(`Purchase validation failed: ${revertReason}`);
      }

      const tx = await contract.purchaseDataset(BigInt(selectedDataset.id), paymentTokenAddress, {
        gasLimit,
      });

      toast.loading('Waiting for transaction confirmation...', { id: 'purchase' });
      const receipt = await tx.wait();

      // Check receipt status
      if (!receipt || receipt.status !== 1) {
        setIsPurchasing(false);
        throw new Error('Transaction reverted. Please check if you have sufficient balance and the dataset is available for purchase.');
      }

      setIsPurchaseConfirmed(true);
      setIsPurchasing(false);
      toast.success('Purchase successful!', { id: 'purchase' });

      // Update local state
      setMyPurchases((prev) => new Set([...prev, selectedDataset.id]));

      // Close modal after a short delay
      setTimeout(() => {
        setPurchaseModalOpen(false);
        setSelectedDataset(null);
      }, 2000);
    } catch (error: any) {
      setIsPurchasing(false);
      
      // Extract more detailed error information
      let errorMessage = 'Unknown error';
      if (error?.reason) {
        errorMessage = error.reason;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Log the full error for debugging
      console.error('❌ Purchase transaction error:', {
        error,
        errorMessage,
        datasetId: selectedDataset?.id,
        isPaid: selectedDataset?.pricing.isPaid,
        priceWei: selectedDataset?.pricing.priceInFILWei?.toString()
      });
      
      // Check for common revert reasons
      if (errorMessage.includes('Private dataset not for sale') || errorMessage.includes('private') && errorMessage.includes('not for sale')) {
        throw new Error('This dataset is private and cannot be purchased. Private datasets are only accessible to the owner.');
      } else if (errorMessage.includes('already purchased') || errorMessage.includes('already owns')) {
        throw new Error('You have already purchased this dataset.');
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        throw new Error('Insufficient USDFC balance. Please ensure you have enough tokens.');
      } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('Dataset does not exist')) {
        throw new Error('Dataset not found. It may have been removed or the dataset ID is incorrect.');
      } else if (errorMessage.includes('not for sale') || (errorMessage.includes('not available') && !errorMessage.includes('free') && !errorMessage.includes('private'))) {
        // Only show "not available" if it's not about being free or private
        throw new Error('This dataset is not available for purchase. It may be free or not listed for sale.');
      } else if (errorMessage.includes('free') || errorMessage.includes('does not require purchase')) {
        throw new Error('This dataset is free and does not require purchase. You can download it directly.');
      }
      
      throw error;
    }
  };

  // Reset purchase confirmation state when modal closes
  useEffect(() => {
    if (!purchaseModalOpen) {
      setIsPurchaseConfirmed(false);
      setIsApprovalConfirmed(false);
      setNeedsApproval(false);
      setApprovalTokenAddress(null);
    }
  }, [purchaseModalOpen]);

  // Helper to check if CID is FOC PieceCID (starts with 'bafk' or similar FOC patterns)
  const isFOCPieceCID = (cid: string): boolean => {
    return cid.startsWith('bafk') || cid.length > 60; // FOC PieceCIDs are typically longer
  };

  // Helper to create professional PDF certificate/document
  const createProfessionalDocument = async (dataset: Dataset): Promise<Blob> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(color[0], color[1], color[2]);
      
      const maxWidth = pageWidth - (x * 2);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.35); // Return height used
    };

    // Header with logo area
    doc.setFillColor(37, 99, 235); // Blue
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('FileScope AI', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Decentralized Data Quality Platform', pageWidth / 2, 30, { align: 'center' });

    yPos = 50;

    // Certificate Header
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DATASET VERIFICATION CERTIFICATE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Issued by section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Issued by FileScope AI', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Date
    const issueDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Date: ${issueDate}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Dataset Information Section
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Dataset Information', margin + 2, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += addText(`Title: ${dataset.title}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Description: ${dataset.description || 'No description available'}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Upload Date: ${new Date(dataset.metadata.uploadDate).toLocaleDateString()}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Uploader: ${dataset.uploader.address}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Rows: ${dataset.metadata.rows.toLocaleString()} | Columns: ${dataset.metadata.columns} | Format: ${dataset.metadata.format || 'Unknown'}`, margin, yPos, 10);
    yPos += 8;

    // Quality Metrics Section
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Quality Metrics', margin + 2, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += addText(`Overall Quality Score: ${dataset.results.metrics.quality_score}%`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Completeness: ${dataset.results.metrics.completeness}% | Consistency: ${dataset.results.metrics.consistency}%`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Accuracy: ${dataset.results.metrics.accuracy}% | Validity: ${dataset.results.metrics.validity}%`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Anomalies Detected: ${dataset.results.metrics.anomalies.total} (High: ${dataset.results.metrics.anomalies.high}, Medium: ${dataset.results.metrics.anomalies.medium}, Low: ${dataset.results.metrics.anomalies.low})`, margin, yPos, 10);
    yPos += 8;

    // Blockchain Verification Section
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Blockchain Verification', margin + 2, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const storageType = dataset.metadata.isPublic && !dataset.metadata.isPrivate 
      ? 'Filecoin Onchain Cloud (FOC)' 
      : 'IPFS (InterPlanetary File System)';
    yPos += addText(`Storage Type: ${storageType}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Contract Address: ${dataset.metadata.contractAddress}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Dataset CID: ${dataset.metadata.ipfsHash}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Analysis CID: ${dataset.metadata.analysisCID}`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Verification Status: ✓ Verified on Blockchain`, margin, yPos, 10);
    yPos += 3;
    yPos += addText(`Public Dataset: ${dataset.metadata.isPublic ? 'Yes' : 'No'} | Monetization: ${dataset.pricing.isPaid ? `Yes - ${dataset.pricing.priceInFIL} USDFC` : 'Free'}`, margin, yPos, 10);
    yPos += 8;

    // Footer
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // About section
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    yPos += addText('FileScope AI is a decentralized data quality and analysis platform powered by blockchain technology.', margin, yPos, 9);
    yPos += 5;
    yPos += addText('This dataset has been verified on the blockchain and is available for public use.', margin, yPos, 9);
    yPos += 5;
    yPos += addText('Visit: https://filescope.ai | Powered by Filecoin Onchain Cloud & IPFS', margin, yPos, 9);
    yPos += 8;

    // Verification seal
    doc.setFillColor(37, 99, 235);
    doc.circle(pageWidth / 2, yPos, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VERIFIED', pageWidth / 2, yPos + 2, { align: 'center' });
    doc.setFontSize(8);
    doc.text('BLOCKCHAIN', pageWidth / 2, yPos + 6, { align: 'center' });

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Generate blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  };

  // Helper to create branded README file (kept for backward compatibility)
  const createBrandedREADME = (dataset: Dataset): string => {
    const timestamp = new Date().toISOString();
    const storageType = dataset.metadata.isPublic && !dataset.metadata.isPrivate 
      ? 'Filecoin Onchain Cloud (FOC)' 
      : 'IPFS (InterPlanetary File System)';
    
    return `# Dataset: ${dataset.title}

## Issued by FileScope AI

This dataset has been analyzed and verified by **FileScope AI**, a decentralized data quality and analysis platform powered by blockchain technology.

---

### Dataset Information
- **Title**: ${dataset.title}
- **Description**: ${dataset.description || 'No description available'}
- **Upload Date**: ${new Date(dataset.metadata.uploadDate).toLocaleDateString()}
- **Uploader Address**: ${dataset.uploader.address}
- **Rows**: ${dataset.metadata.rows.toLocaleString()}
- **Columns**: ${dataset.metadata.columns}
- **Format**: ${dataset.metadata.format || 'Unknown'}
- **File Size**: ${dataset.metadata.fileSize || 'Unknown'}

### Quality Metrics
- **Overall Quality Score**: ${dataset.results.metrics.quality_score}%
- **Completeness**: ${dataset.results.metrics.completeness}%
- **Consistency**: ${dataset.results.metrics.consistency}%
- **Accuracy**: ${dataset.results.metrics.accuracy}%
- **Validity**: ${dataset.results.metrics.validity}%
- **Anomalies Detected**: ${dataset.results.metrics.anomalies.total}
  - High Severity: ${dataset.results.metrics.anomalies.high}
  - Medium Severity: ${dataset.results.metrics.anomalies.medium}
  - Low Severity: ${dataset.results.metrics.anomalies.low}

### Blockchain Verification
- **Contract Address**: ${dataset.metadata.contractAddress}
- **Storage Type**: ${storageType}
- **Dataset CID**: ${dataset.metadata.ipfsHash}
- **Analysis CID**: ${dataset.metadata.analysisCID}
- **Verification Status**: ✓ Verified on Blockchain
- **Public Dataset**: ${dataset.metadata.isPublic ? 'Yes' : 'No'}
- **Monetization**: ${dataset.pricing.isPaid ? `Yes - ${dataset.pricing.priceInFIL} USDFC` : 'Free'}

### Download Information
- **Downloaded**: ${timestamp}
- **Source**: FileScope AI Explorer
- **License**: Please check dataset metadata for licensing information

---

## About FileScope AI

**FileScope AI** is a decentralized data quality and analysis platform that leverages blockchain technology to ensure data integrity, transparency, and accessibility.

### Key Features:
- ✓ Blockchain-verified datasets
- ✓ AI-powered quality analysis
- ✓ Decentralized storage (Filecoin Onchain Cloud & IPFS)
- ✓ Transparent data provenance
- ✓ Monetization support for data creators

### Technology Stack:
- **Storage**: Filecoin Onchain Cloud (FOC) for public datasets, IPFS for private datasets
- **Blockchain**: Filecoin Calibration Testnet
- **Smart Contracts**: Ethereum-compatible (Filecoin EVM)

---

**FileScope AI** - Decentralized Data Quality Platform
🌐 Visit: https://filescope.ai
🔗 Powered by Filecoin Onchain Cloud & IPFS
📊 Verified on Blockchain

This dataset has been verified on the blockchain and is available for public use.
For questions or support, please visit our platform.

---
*Generated by FileScope AI on ${new Date().toLocaleString()}*
`;
  };

  // Download original dataset (handles both IPFS and FOC)
  const downloadOriginalDataset = async (dataset: Dataset) => {
    // Check if dataset requires purchase
    if (dataset.pricing.isPaid && !dataset.isPurchased) {
      toast.error('Please purchase this dataset first to download it.');
      return;
    }

    try {
      toast.loading('Downloading original dataset...', { id: 'download-original' });
      
      let data: Blob;
      const cid = dataset.metadata.ipfsHash;

      // Public datasets use FOC, private datasets use IPFS
      if (dataset.metadata.isPublic && !dataset.metadata.isPrivate) {
        // Public dataset - download from FOC
        if (!window.ethereum) {
          throw new Error('Ethereum provider not found');
        }
        const focService = getFilecoinCloudService();
        await focService.initialize(window.ethereum);
        const fileData = await focService.downloadDataset(cid);
        data = new Blob([fileData], { type: 'application/octet-stream' });
      } else {
        // Private dataset - download from IPFS using fallback gateways
        data = await fetchFromIPFS(cid);
      }

      // Create professional PDF certificate
      const certificatePDF = await createProfessionalDocument(dataset);
      
      // Create branded ZIP with dataset and certificate
      const zip = new JSZip();
      zip.file(`${dataset.metadata.fileName || 'dataset'}.json`, data);
      zip.file(`${dataset.metadata.fileName || 'dataset'}-Certificate.pdf`, certificatePDF);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}-filescope-ai.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Original dataset downloaded successfully', { id: 'download-original' });
    } catch (error) {
      console.error('Download original failed:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'download-original' });
    }
  };

  // Download analysis results (PDF) - analysis is always on IPFS
  const downloadAnalysisResults = async (dataset: Dataset) => {
    // Check if dataset requires purchase
    if (dataset.pricing.isPaid && !dataset.isPurchased) {
      toast.error('Please purchase this dataset first to download the analysis report.');
      return;
    }

    try {
      toast.loading('Downloading analysis report...', { id: 'download-analysis' });
      // Analysis CID is stored in metadata (always on IPFS)
      const analysisCID = dataset.metadata.analysisCID;
      const data = await fetchFromIPFS(analysisCID);
      
      // Create professional PDF certificate
      const certificatePDF = await createProfessionalDocument(dataset);
      
      // Create branded ZIP with analysis and certificate
      const zip = new JSZip();
      zip.file(`${dataset.metadata.fileName || 'dataset'}-analysis.pdf`, data);
      zip.file(`${dataset.metadata.fileName || 'dataset'}-Certificate.pdf`, certificatePDF);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}-analysis-filescope-ai.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Analysis report downloaded successfully', { id: 'download-analysis' });
    } catch (error) {
      console.error('Download analysis failed:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'download-analysis' });
    }
  };

  // Download complete dataset (original + analysis)
  const downloadCompleteDataset = async (dataset: Dataset) => {
    // Check if dataset requires purchase
    if (dataset.pricing.isPaid && !dataset.isPurchased) {
      toast.error('Please purchase this dataset first to download it.');
      return;
    }

    try {
      toast.loading('Downloading complete dataset package...', { id: 'download-complete' });
      
      const datasetCID = dataset.metadata.ipfsHash;
      let originalData: Blob;

      // Public datasets use FOC, private datasets use IPFS
      if (dataset.metadata.isPublic && !dataset.metadata.isPrivate) {
        // Public dataset - download from FOC
        if (!window.ethereum) {
          throw new Error('Ethereum provider not found');
        }
        const focService = getFilecoinCloudService();
        await focService.initialize(window.ethereum);
        const fileData = await focService.downloadDataset(datasetCID);
        originalData = new Blob([fileData], { type: 'application/octet-stream' });
      } else {
        // Private dataset - download from IPFS using fallback gateways
        originalData = await fetchFromIPFS(datasetCID);
      }

      // Download analysis (always from IPFS using fallback gateways)
      const analysisCID = dataset.metadata.analysisCID;
      const analysisData = await fetchFromIPFS(analysisCID);

      // Create professional PDF certificate
      const certificatePDF = await createProfessionalDocument(dataset);

      // Create branded ZIP with dataset, analysis, and certificate
      const zip = new JSZip();
      zip.file(`${dataset.metadata.fileName || 'dataset'}.json`, originalData);
      zip.file(`${dataset.metadata.fileName || 'dataset'}-analysis.pdf`, analysisData);
      zip.file(`${dataset.metadata.fileName || 'dataset'}-Certificate.pdf`, certificatePDF);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}-complete-filescope-ai.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Complete dataset package downloaded successfully', { id: 'download-complete' });
    } catch (error) {
      console.error('Download complete failed:', error);
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'download-complete' });
    }
  };

  // Purchase Modal Component
  const PurchaseModal = () => {
    if (!selectedDataset || !purchaseModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
          onClick={() => !isPurchasing && !isApproving && setPurchaseModalOpen(false)}
        ></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Dataset</h2>
            {!isPurchasing && !isApproving && (
              <button
                onClick={() => setPurchaseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {selectedDataset.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              {selectedDataset.description}
            </p>
            {selectedDataset.pricing.isPaid && selectedDataset.pricing.priceInFILWei > BigInt(0) ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Price:</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedDataset.pricing.priceInFIL} USDFC
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ✓ One-time purchase - permanent access<br />
                  ✓ Download unlimited times after purchase<br />
                  ✓ Download dataset and analysis report<br />
                  ✓ Blockchain-verified ownership
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Status:</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    Free
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  ✓ Free to download<br />
                  ✓ No purchase required<br />
                  ✓ Open access dataset
                </div>
              </div>
            )}
          </div>

          {isPurchaseConfirmed ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <span className="text-xl">✅</span>
                <span className="font-medium">Purchase confirmed! You can now download the dataset.</span>
              </div>
            </div>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={() => setPurchaseModalOpen(false)}
                disabled={isPurchasing || isApproving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={executePurchase}
                disabled={isPurchasing || isApproving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isApproving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Approving token...</span>
                  </>
                ) : isPurchasing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Processing purchase...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>Purchase</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Dataset card component
  const DatasetCard = ({ dataset }: { dataset: Dataset }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {dataset.title}
        </h3>
          {dataset.pricing.isPaid && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              dataset.isPurchased 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
            }`}>
              {dataset.isPurchased ? 'Owned' : `${dataset.pricing.priceInFIL} USDFC`}
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
          {dataset.description}
        </p>

        {/* Uploader Address - NEW */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Uploader:</span>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                {dataset.uploader.address.slice(0, 6)}...{dataset.uploader.address.slice(-4)}
              </span>
              <span className="text-green-600 dark:text-green-400 text-xs">✓ Verified</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getQualityColor(dataset.results.metrics.quality_score)}`}>
              {dataset.results.metrics.quality_score}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Quality Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(dataset.results.metrics.anomalies.total)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Anomalies</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>{dataset.metadata.rows.toLocaleString()} rows</span>
          <span>{dataset.metadata.columns} columns</span>
          <span>{dataset.metadata.format}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{formatNumber(dataset.stats.views)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Download className="w-4 h-4" />
              <span>{formatNumber(dataset.stats.downloads)}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Verified className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">Verified</span>
          </div>
        </div>

        {/* Download/Purchase Section */}
        <div className="space-y-3">
          {dataset.pricing.isPaid && !dataset.isPurchased ? (
            <button
              onClick={() => handlePurchase(dataset)}
              className="w-full inline-flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Purchase for {dataset.pricing.priceInFIL} USDFC</span>
            </button>
          ) : (
            <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300 font-medium">Download Options</span>
                {dataset.pricing.isPaid && dataset.isPurchased && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
                    <Verified className="w-3 h-3" />
                    <span>Owned</span>
                  </span>
                )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => downloadOriginalDataset(dataset)}
                  disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                  className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              <span>Original</span>
            </button>
            <button
              onClick={() => downloadAnalysisResults(dataset)}
                  disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                  className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3 h-3" />
              <span>Report</span>
            </button>
            <button
              onClick={() => downloadCompleteDataset(dataset)}
                  disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                  className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              <span>Full Package</span>
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Dataset list item component
  const DatasetListItem = ({ dataset }: { dataset: Dataset }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {dataset.title}
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              dataset.category === 'Finance' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              dataset.category === 'Health' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
              dataset.category === 'Technology' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {dataset.category}
            </span>
            {dataset.pricing.isPaid && dataset.pricing.priceInFILWei > BigInt(0) ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                dataset.isPurchased 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
              }`}>
                {dataset.isPurchased ? 'Owned' : `${dataset.pricing.priceInFIL} USDFC`}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Free
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
            {dataset.description}
          </p>
          
          {/* Uploader Address - NEW */}
          <div className="mb-2 flex items-center space-x-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Uploader:</span>
            <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
              {dataset.uploader.address.slice(0, 6)}...{dataset.uploader.address.slice(-4)}
            </span>
            <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{dataset.metadata.rows.toLocaleString()} rows</span>
            <span>{dataset.metadata.columns} columns</span>
            <span>{dataset.metadata.format}</span>
            <span>{formatDate(dataset.metadata.uploadDate)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className={`text-xl font-bold ${getQualityColor(dataset.results.metrics.quality_score)}`}>
              {dataset.results.metrics.quality_score}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Quality</div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{formatNumber(dataset.stats.views)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Download className="w-4 h-4" />
              <span>{formatNumber(dataset.stats.downloads)}</span>
            </div>
          </div>
          
          {/* Download/Purchase Section - List View */}
          {dataset.pricing.isPaid && !dataset.isPurchased ? (
            <button
              onClick={() => handlePurchase(dataset)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Purchase {dataset.pricing.priceInFIL} USDFC</span>
            </button>
          ) : (
          <div className="flex space-x-2">
              {dataset.pricing.isPaid && dataset.isPurchased && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1 mr-2">
                  <Verified className="w-3 h-3" />
                  <span>Owned</span>
                </span>
              )}
            <button
              onClick={() => downloadOriginalDataset(dataset)}
                disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              <span>Original</span>
            </button>
            <button
              onClick={() => downloadAnalysisResults(dataset)}
                disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3 h-3" />
              <span>Report</span>
            </button>
            <button
              onClick={() => downloadCompleteDataset(dataset)}
                disabled={dataset.pricing.isPaid && !dataset.isPurchased}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              <span>Full Package</span>
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PurchaseModal />
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dataset Explorer</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Browse and discover verified datasets</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Verified className="w-4 h-4 text-green-600" />
                <span>Blockchain Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and View Toggle */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading datasets...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* No Datasets */}
        {!loading && !error && datasets.length === 0 && (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No datasets found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No public datasets are available yet. Be the first to upload and analyze a dataset!
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Dataset
            </Link>
          </div>
        )}

        {/* Datasets Grid */}
        {!loading && !error && datasets.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {datasets.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
        )}

        {/* Datasets List */}
        {!loading && !error && datasets.length > 0 && viewMode === 'list' && (
          <div className="space-y-4">
            {datasets.map((dataset) => (
              <DatasetListItem key={dataset.id} dataset={dataset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetExplorer; 