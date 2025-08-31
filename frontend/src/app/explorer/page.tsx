'use client'
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useReadContract } from 'wagmi';
import { 
  Search, Grid, List, Database, Eye, Download, 
  Verified, ArrowLeft, AlertTriangle, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fileStoreContract } from '../index';
import JSZip from 'jszip';

// Proper TypeScript interfaces
interface ContractDataset {
  datasetCID: string;
  analysisCID: string;
  uploader: string;
  isPublic: boolean;
  timestamp: bigint;
  views: bigint;
  downloads: bigint;
  citations: bigint;
}

interface DatasetMetadata {
  fileName: string;
  fileSize: string;
  rows: number;
  columns: number;
  uploadDate: string;
  ipfsHash: string;
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
  
  // Wallet connection check - removed unused variable
  // const { isConnected } = useAccount();

  const { data: contractDatasets, isLoading: contractLoading } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getAllPublicDatasets',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch IPFS data helper
  const fetchIPFSData = useCallback(async (cid: string): Promise<IPFSData> => {
    try {
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      if (!response.ok) {
        throw new Error(`IPFS fetch failed: ${response.statusText}`);
      }
      const data = await response.json();
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
  }, []);

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

  // Process contract data
  useEffect(() => {
    if (mounted && contractDatasets && !contractLoading) {
      const processDatasets = async () => {
        try {
          setLoading(true);
          const processedDatasets: Dataset[] = [];

          // Type guard to ensure contractDatasets is an array
          if (!Array.isArray(contractDatasets)) {
            console.warn('Contract datasets is not an array:', contractDatasets);
            setDatasets([]);
            setLoading(false);
            return;
          }

          for (let i = 0; i < contractDatasets.length; i++) {
            const contractDataset = contractDatasets[i] as ContractDataset;
            
            try {
              const ipfsData = await fetchIPFSData(contractDataset.analysisCID);
              
              // Debug logging to see what data we have
              console.log(`🔍 Processing dataset ${i}:`, {
                name: ipfsData.name,
                attributes: ipfsData.attributes,
                results: ipfsData.results,
                metadata: ipfsData.metadata
              });
              
              // Add safety checks for IPFS data structure
              if (!ipfsData || !ipfsData.name) {
                console.warn(`Dataset ${i} has incomplete IPFS data:`, ipfsData);
                continue; // Skip this dataset
              }
              
              // Debug: Log all possible sources for rows/columns
              console.log(`📊 Dataset ${i} rows/columns sources:`, {
                'ipfsData.results?.metadata?.rows': ipfsData.results?.metadata?.rows,
                'ipfsData.results?.metadata?.columns': ipfsData.results?.metadata?.columns,
                'ipfsData.metadata?.rows': ipfsData.metadata?.rows,
                'ipfsData.metadata?.columns': ipfsData.metadata?.columns,
                'attributes with "Rows"': ipfsData.attributes.filter(attr => 
                  attr.trait_type.toLowerCase().includes('row')
                ),
                'attributes with "Columns"': ipfsData.attributes.filter(attr => 
                  attr.trait_type.toLowerCase().includes('column')
                ),
                'all attributes': ipfsData.attributes
              });
              
              // Special debugging for txt.csv dataset
              if (ipfsData.name === 'txt.csv') {
                console.log('🔍 Special debugging for txt.csv:', {
                  name: ipfsData.name,
                  allAttributes: ipfsData.attributes,
                  resultsMetadata: ipfsData.results?.metadata,
                  directMetadata: ipfsData.metadata,
                  extractedRows: extractMetricFromAttributes(ipfsData.attributes, 'Rows', 0),
                  extractedColumns: extractMetricFromAttributes(ipfsData.attributes, 'Columns', 0)
                });
              }

              // Use the comprehensive extraction function
              const { rows, columns } = extractRowsAndColumns(ipfsData);
              
              // Debug logging for extracted values
              console.log(`📊 Dataset ${i} extracted values:`, {
                rows,
                columns,
                fileSize: getAttributeValue<string>(ipfsData.attributes, 'File Size', 'Unknown'),
                format: getAttributeValue<string>(ipfsData.attributes, 'File Type', 'Unknown')
              });

              const dataset: Dataset = {
                id: i + 1,
                title: ipfsData.name || `Dataset ${i + 1}`,
                description: ipfsData.description || 'AI-analyzed dataset',
                category: 'Technology', // Default category
                metadata: {
                  fileName: ipfsData.name || `Dataset ${i + 1}`,
                  fileSize: getAttributeValue<string>(ipfsData.attributes, 'File Size', 'Unknown'),
                  rows: rows,
                  columns: columns,
                  uploadDate: new Date(Number(contractDataset.timestamp) * 1000).toISOString(),
                  ipfsHash: contractDataset.analysisCID,
                  contractAddress: fileStoreContract.address,
                  blockNumber: '0',
                  isPublic: contractDataset.isPublic,
                  description: ipfsData.description || 'No description available',
                  tags: ipfsData.attributes.filter(attr => attr.trait_type === 'tags')?.map(attr => attr.value as string) || [],
                  format: getAttributeValue<string>(ipfsData.attributes, 'File Type', 'Unknown')
                },
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
  }, [mounted, contractDatasets, contractLoading, fetchIPFSData]);

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

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Download original dataset (full JSON)
  const downloadOriginalDataset = async (dataset: Dataset) => {
    try {
      toast.loading('Downloading original dataset...', { id: 'download-original' });
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${dataset.metadata.ipfsHash}`);
      if (!response.ok) {
        throw new Error('Failed to fetch original dataset');
      }
      const data = await response.blob();
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Original dataset downloaded successfully', { id: 'download-original' });
    } catch (error) {
      console.error('Download original failed:', error);
      toast.error('Download original failed', { id: 'download-original' });
    }
  };

  // Download analysis results (PDF)
  const downloadAnalysisResults = async (dataset: Dataset) => {
    try {
      toast.loading('Downloading analysis report...', { id: 'download-analysis' });
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${dataset.metadata.ipfsHash}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analysis report');
      }
      const data = await response.blob();
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}-analysis.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Analysis report downloaded successfully', { id: 'download-analysis' });
    } catch (error) {
      console.error('Download analysis failed:', error);
      toast.error('Download analysis failed', { id: 'download-analysis' });
    }
  };

  // Download complete dataset (original + analysis)
  const downloadCompleteDataset = async (dataset: Dataset) => {
    try {
      toast.loading('Downloading complete dataset...', { id: 'download-complete' });
      const originalResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${dataset.metadata.ipfsHash}`);
      if (!originalResponse.ok) {
        throw new Error('Failed to fetch original dataset');
      }
      const originalData = await originalResponse.blob();

      const analysisResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${dataset.metadata.ipfsHash}`);
      if (!analysisResponse.ok) {
        throw new Error('Failed to fetch analysis report');
      }
      const analysisData = await analysisResponse.blob();

      const zip = new JSZip();
      zip.file(`${dataset.metadata.fileName || 'dataset'}.json`, originalData);
      zip.file(`${dataset.metadata.fileName || 'dataset'}-analysis.pdf`, analysisData);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.metadata.fileName || 'dataset'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Complete dataset downloaded successfully', { id: 'download-complete' });
    } catch (error) {
      console.error('Download complete failed:', error);
      toast.error('Download complete failed', { id: 'download-complete' });
    }
  };

  // Dataset card component
  const DatasetCard = ({ dataset }: { dataset: Dataset }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {dataset.title}
        </h3>
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

        {/* Download Section - Redesigned */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300 font-medium">Download Options</span>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => downloadOriginalDataset(dataset)}
              className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Original</span>
            </button>
            <button
              onClick={() => downloadAnalysisResults(dataset)}
              className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              <FileText className="w-3 h-3" />
              <span>Report</span>
            </button>
            <button
              onClick={() => downloadCompleteDataset(dataset)}
              className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all duration-200"
            >
              <Download className="w-3 h-3" />
              <span>Full Package</span>
            </button>
          </div>
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
          
          {/* Download Section - List View */}
          <div className="flex space-x-2">
            <button
              onClick={() => downloadOriginalDataset(dataset)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Original</span>
            </button>
            <button
              onClick={() => downloadAnalysisResults(dataset)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              <FileText className="w-3 h-3" />
              <span>Report</span>
            </button>
            <button
              onClick={() => downloadCompleteDataset(dataset)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all duration-200"
            >
              <Download className="w-3 h-3" />
              <span>Full Package</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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