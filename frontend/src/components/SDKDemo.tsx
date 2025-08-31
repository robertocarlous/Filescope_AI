'use client'
import React, { useState } from 'react';
import { FileScopeSDK, useFileScopeAnalysis } from '../lib/filescope-sdk';
import { Upload, FileText, BarChart3, AlertTriangle, CheckCircle, Download, RefreshCw } from 'lucide-react';

interface DemoResults {
  quality_score: number;
  anomalies: {
    total: number;
    critical: number;
    warnings: number;
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
}

const SDKDemo: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<DemoResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // Using the React hook
  const { analyzeFile, isAnalyzing: hookAnalyzing, progress } = useFileScopeAnalysis(apiKey, {
    onSuccess: (results) => {
      console.log('Analysis completed successfully:', results);
      setResults(results as DemoResults);
      setAnalysisId(results.analysis_id);
    },
    onError: (error) => {
      console.error('Analysis failed:', error);
      setError(error);
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResults(null);
    }
  };

  const handleAnalyzeWithHook = async () => {
    if (!selectedFile || !apiKey) {
      setError('Please select a file and enter your API key');
      return;
    }

    try {
      await analyzeFile(selectedFile, {
        isPublic: true,
        analysisType: 'comprehensive',
        includeInsights: true
      });
    } catch {
      // Error is handled by the hook's onError callback
    }
  };

  const handleAnalyzeWithSDK = async () => {
    if (!selectedFile || !apiKey) {
      setError('Please select a file and enter your API key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const sdk = new FileScopeSDK(apiKey);
      const result = await sdk.analyzeDataset(selectedFile, {
        isPublic: true,
        analysisType: 'comprehensive',
        includeInsights: true
      });

      setResults(result as DemoResults);
      setAnalysisId(result.analysis_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!analysisId || !apiKey) {
      setError('No analysis ID available');
      return;
    }

    try {
      const sdk = new FileScopeSDK(apiKey);
      const report = await sdk.downloadReport(analysisId);
      
      // Create download link
      const url = URL.createObjectURL(report);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis-report-${analysisId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download report';
      setError(errorMessage);
    }
  };

  const resetDemo = () => {
    setSelectedFile(null);
    setResults(null);
    setError(null);
    setAnalysisId(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* API Key Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Key</h3>
        <div className="flex space-x-4">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your FileScope AI API key"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={resetDemo}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Get your API key from the FileScope AI dashboard
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dataset Upload</h3>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.json,.parquet"
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {selectedFile ? selectedFile.name : 'Click to upload dataset'}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Supports CSV, Excel, JSON, and Parquet files
            </p>
          </label>
        </div>
        {selectedFile && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {selectedFile.name}
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}
      </div>

      {/* Analysis Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis Methods</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Using React Hook</h4>
            <button
              onClick={handleAnalyzeWithHook}
              disabled={!selectedFile || !apiKey || hookAnalyzing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {hookAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Analyze with Hook</span>
                </>
              )}
            </button>
            {hookAnalyzing && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Progress: {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Using SDK Directly</h4>
            <button
              onClick={handleAnalyzeWithSDK}
              disabled={!selectedFile || !apiKey || isAnalyzing}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Analyze with SDK</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800 dark:text-red-200">Error</span>
          </div>
          <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analysis Results</h3>
            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Report</span>
            </button>
          </div>

          {/* Quality Score */}
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Quality Score</h4>
            </div>
            <div className="text-4xl font-bold text-green-600">{results.quality_score}%</div>
          </div>

          {/* Data Quality Metrics */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Data Quality Metrics</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Completeness</span>
                  <span className="font-medium">{results.data_quality.completeness}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Accuracy</span>
                  <span className="font-medium">{results.data_quality.accuracy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Consistency</span>
                  <span className="font-medium">{results.data_quality.consistency}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Validity</span>
                  <span className="font-medium">{results.data_quality.validity}%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Anomalies</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                  <span className="font-medium">{results.anomalies.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Critical</span>
                  <span className="font-medium text-red-600">{results.anomalies.critical}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Warnings</span>
                  <span className="font-medium text-yellow-600">{results.anomalies.warnings}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights */}
          {results.insights.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Key Insights</h4>
              <div className="space-y-2">
                {results.insights.slice(0, 5).map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      insight.severity === 'high'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : insight.severity === 'medium'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{insight.message}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        insight.severity === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : insight.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {insight.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Confidence: {insight.confidence}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code Examples */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Code Examples</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">React Hook Usage</h4>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`const { analyzeFile, isAnalyzing, results, error, progress } = useFileScopeAnalysis('your-api-key');

const handleUpload = async (file) => {
  await analyzeFile(file, { isPublic: true });
};`}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Direct SDK Usage</h4>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`const sdk = new FileScopeSDK('your-api-key');
const results = await sdk.analyzeDataset(file, { isPublic: true });`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDKDemo; 