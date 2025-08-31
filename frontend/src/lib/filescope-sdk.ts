import { useState, useCallback, useMemo } from 'react';

/**
 * FileScope AI SDK
 * Simple SDK for integrating FileScope AI analysis into your applications
 */

export interface AnalysisOptions {
  isPublic?: boolean;
  analysisType?: 'basic' | 'comprehensive' | 'custom';
  includeInsights?: boolean;
  customMetrics?: string[];
}

export interface AnalysisResult {
  analysis_id: string;
  quality_score: number;
  anomalies: {
    total: number;
    critical: number;
    warnings: number;
    details: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
      row?: number;
      column?: string;
    }>;
  };
  data_quality: {
    score: number;
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
  };
  insights: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
  }>;
  created_at: string;
  status: 'completed' | 'processing' | 'failed';
  file_info: {
    name: string;
    size: number;
    type: string;
    rows: number;
    columns: number;
  };
}

export interface PublicDataset {
  id: string;
  title: string;
  description: string;
  quality_score: number;
  category: string;
  size: number;
  last_updated: string;
  download_url: string;
}

export class FileScopeSDK {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://filescopeai-qdpp.onrender.com/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async analyzeDataset(file: File, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options as form data
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getResults(analysisId: string): Promise<AnalysisResult> {
    return this.makeRequest(`/results/${analysisId}`) as Promise<AnalysisResult>;
  }

  async getPublicDatasets(): Promise<PublicDataset[]> {
    return this.makeRequest('/datasets/public') as Promise<PublicDataset[]>;
  }

  async downloadReport(analysisId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/reports/${analysisId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }

  async getAnalysisStatus(analysisId: string): Promise<{ status: string; progress?: number }> {
    return this.makeRequest(`/status/${analysisId}`) as Promise<{ status: string; progress?: number }>;
  }

  async cancelAnalysis(analysisId: string): Promise<void> {
    await this.makeRequest(`/cancel/${analysisId}`, { method: 'POST' });
  }
}

// React Hook for React applications
export function useFileScopeAnalysis(apiKey: string, options?: {
  onSuccess?: (results: AnalysisResult) => void;
  onError?: (error: string) => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const sdk = useMemo(() => new FileScopeSDK(apiKey), [apiKey]);

  const analyzeFile = useCallback(async (file: File, analysisOptions?: AnalysisOptions) => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(0);
    setResults(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      const result = await sdk.analyzeDataset(file, analysisOptions);
      
      clearInterval(progressInterval);
      setProgress(100);
      setResults(result);
      options?.onSuccess?.(result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [sdk, options]);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setResults(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    analyzeFile,
    isAnalyzing,
    results,
    error,
    progress,
    reset,
    sdk,
  };
} 