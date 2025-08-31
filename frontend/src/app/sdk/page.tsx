'use client'
import React, { useState } from 'react';
import { Code, Download, FileText, Zap, Database, Shield, BarChart3, Copy, Check, Terminal, Users, BarChart, Code2, FileCode, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import SDKDemo from '../../components/SDKDemo';

const SDKPage = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const copyToClipboard = async (code: string, label: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const CodeBlock = ({ code, language, label }: { code: string; language: string; label: string }) => (
    <div className="relative">
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 rounded-t-lg">
        <span className="text-gray-300 text-sm font-medium">{language}</span>
        <button
          onClick={() => copyToClipboard(code, label)}
          className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
        >
          {copiedCode === label ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span className="text-sm">
            {copiedCode === label ? 'Copied!' : 'Copy'}
          </span>
        </button>
      </div>
      <pre className="bg-gray-900 dark:bg-gray-950 rounded-b-lg p-4 overflow-x-auto">
        <code className="text-green-400 text-sm">{code}</code>
      </pre>
    </div>
  );

  const InstallationStep = ({ number, title, description, code, language, label }: {
    number: number;
    title: string;
    description: string;
    code: string;
    language: string;
    label: string;
  }) => (
    <div className="flex space-x-4">
      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
        <p className="text-gray-600 dark:text-gray-300 mb-3">{description}</p>
        <CodeBlock code={code} language={language} label={label} />
      </div>
    </div>
  );

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: Code },
    { id: 'setup', label: 'Setting up the Environment', icon: Terminal },
    { id: 'installation', label: 'Installation', icon: Download },
    { id: 'quickstart', label: 'Quick Start', icon: Zap },
    { id: 'api', label: 'API Reference', icon: FileText },
    { id: 'react-hook', label: 'React Hook Integration', icon: Database },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Code className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
                FileScope AI SDK
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Integrate powerful AI dataset analysis into your applications with our simple, powerful SDK
              </p>
              <div className="flex justify-center space-x-4 mt-6">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <Users className="w-5 h-5" />
                  <span>For Developers</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <BarChart className="w-5 h-5" />
                  <span>For Data Scientists</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <Code2 className="w-5 h-5" />
                  <span>For Engineers</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Easy Integration</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Simple API calls to analyze datasets, get results, and download reports
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Type Safe</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Full TypeScript support with comprehensive type definitions
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">AI Powered</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Advanced AI analysis for data quality, anomalies, and bias detection
                </p>
              </div>
            </div>

            {/* Interactive Demo */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Try It Out!</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                Test the FileScope AI SDK right here with your own dataset
              </p>
              <SDKDemo />
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl mb-6 opacity-90">
                Integrate powerful AI dataset analysis into your applications today
              </p>
              <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Get API Key
              </button>
            </div>
          </div>
        );

      case 'setup':
        return (
          <div className="space-y-8">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Prerequisites
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300">
                Before you start using the FileScope AI SDK, make sure you have the following:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-1 text-yellow-700 dark:text-yellow-300">
                <li>A FileScope AI account and API key</li>
                <li>Node.js 18.0 or higher (for JavaScript/TypeScript)</li>
                <li>Python 3.8+ (for Python SDK)</li>
                <li>Basic knowledge of your chosen programming language</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Getting Your API Key</h3>
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Sign Up</h4>
                    <p className="text-gray-600 dark:text-gray-300 mb-3">
                      Create a free account at FileScope AI
                    </p>
                    <CodeBlock
                      code={`# Visit our website
https://filescope.ai/signup`}
                      language="bash"
                      label="signup-url"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Generate API Key</h4>
                    <p className="text-gray-600 dark:text-gray-300 mb-3">
                      Navigate to your dashboard and generate a new API key
                    </p>
                    <CodeBlock
                      code={`# Your API key will look like this
sk-1234567890abcdef1234567890abcdef1234567890abcdef`}
                      language="bash"
                      label="api-key-format"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Store Securely</h4>
                    <p className="text-gray-600 dark:text-gray-300 mb-3">
                      Store your API key in environment variables or secure configuration
                    </p>
                    <CodeBlock
                      code={`# For Node.js projects
export FILESCOPE_API_KEY="sk-1234567890abcdef1234567890abcdef1234567890abcdef"

# For Python projects
export FILESCOPE_API_KEY="sk-1234567890abcdef1234567890abcdef1234567890abcdef"`}
                      language="bash"
                      label="store-api-key"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Environment Setup</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Node.js Environment</h4>
                  <CodeBlock
                    code={`# Check Node.js version (should be >= 18.0)
node --version

# If you need to install or upgrade Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs`}
                    language="bash"
                    label="node-setup"
                  />
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Python Environment</h4>
                  <CodeBlock
                    code={`# Check Python version (should be >= 3.8)
python3 --version

# Install required packages
pip install requests pandas numpy`}
                    language="bash"
                    label="python-setup"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'installation':
        return (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Code2 className="w-6 h-6 mr-2 text-blue-600" />
                React & Next.js
              </h3>
              <div className="space-y-6">
                <InstallationStep
                  number={1}
                  title="Install SDK Package"
                  description="Install the FileScope AI SDK from GitHub"
                  code={`# Install directly from GitHub
npm install github:Abidoyesimze/FileScopeAI

# Or using yarn
yarn add github:Abidoyesimze/FileScopeAI

# Alternative: Clone and install locally
git clone https://github.com/Abidoyesimze/FileScopeAI.git
cd FileScopeAI
npm install
npm run build`}
                  language="bash"
                  label="install-sdk-package"
                />
                <InstallationStep
                  number={2}
                  title="Import in Your Component"
                  description="Import the SDK and React hook in your React component"
                  code={`# Import from GitHub package
import { FileScopeSDK, useFileScopeAnalysis } from 'filescope-ai-sdk';

# The package will be available after GitHub installation`}
                  language="typescript"
                  label="import-sdk"
                />
                <InstallationStep
                  number={3}
                  title="Use in Your Component"
                  description="Implement the SDK in your React component"
                  code={`function MyComponent() {
  const { analyzeFile, isAnalyzing, results, error } = useFileScopeAnalysis('your-api-key');
  
  const handleFileUpload = async (file) => {
    try {
      const result = await analyzeFile(file);
      console.log('Analysis complete:', result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />
      {isAnalyzing && <p>Analyzing...</p>}
      {results && <p>Quality: {results.quality_score}%</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}`}
                  language="typescript"
                  label="use-in-component"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FileCode className="w-6 h-6 mr-2 text-green-600" />
                Vanilla JavaScript
              </h3>
              <div className="space-y-6">
                <InstallationStep
                  number={1}
                  title="Include SDK Script"
                  description="Add the SDK script to your HTML file"
                  code={`<script src="https://unpkg.com/filescope-ai-sdk@latest/dist/index.js"></script>`}
                  language="html"
                  label="include-script"
                />
                <InstallationStep
                  number={2}
                  title="Initialize SDK"
                  description="Create a new instance of the FileScope SDK"
                  code={`const sdk = new FileScopeSDK('your-api-key');`}
                  language="javascript"
                  label="init-sdk"
                />
                <InstallationStep
                  number={3}
                  title="Analyze Dataset"
                  description="Use the SDK to analyze your dataset"
                  code={`// Handle file upload
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const results = await sdk.analyzeDataset(file, { isPublic: true });
      console.log('Quality Score:', results.quality_score);
      console.log('Anomalies:', results.anomalies.total);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }
});`}
                  language="javascript"
                  label="analyze-dataset"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Terminal className="w-6 h-6 mr-2 text-yellow-600" />
                Python (Data Scientists)
              </h3>
              <div className="space-y-6">
                <InstallationStep
                  number={1}
                  title="Install SDK Package"
                  description="Install the FileScope AI SDK using pip"
                  code={`# Install the SDK
pip install filescope-ai-sdk

# Or with specific version
pip install filescope-ai-sdk==1.0.0`}
                  language="bash"
                  label="install-python-sdk"
                />
                <InstallationStep
                  number={2}
                  title="Import and Use"
                  description="Import the SDK and start analyzing datasets"
                  code={`# Import the SDK
from filescope_ai_sdk import FileScopePythonSDK

# Initialize SDK
sdk = FileScopePythonSDK("your-api-key")

# Analyze dataset
results = sdk.analyze_dataset("data.csv", is_public=True)`}
                  language="python"
                  label="use-python-sdk"
                />
              </div>
            </div>
          </div>
        );

      case 'quickstart':
        return (
          <div className="space-y-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Quick Start Guide
              </h3>
              <p className="text-blue-700 dark:text-blue-300">
                Get up and running with FileScope AI SDK in under 5 minutes. Follow these simple steps to analyze your first dataset.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Basic Analysis</h3>
                <CodeBlock
                  code={`const sdk = new FileScopeSDK('your-api-key');

// Analyze a dataset
const results = await sdk.analyzeDataset(file, {
  isPublic: true
});

console.log('Quality Score:', results.quality_score);
console.log('Anomalies:', results.anomalies.total);`}
                  language="javascript"
                  label="basic-analysis"
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Get Public Datasets</h3>
                <CodeBlock
                  code={`// Get list of public datasets
const datasets = await sdk.getPublicDatasets();

datasets.forEach(dataset => {
  console.log(\`\${dataset.title}: \${dataset.quality_score}% quality\`);
});`}
                  language="javascript"
                  label="get-datasets"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Complete Example</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Here&apos;s a complete working example that you can copy and paste into your project:
              </p>
              <CodeBlock
                code={`<!DOCTYPE html>
<html>
<head>
    <title>FileScope AI Demo</title>
    <script src="https://unpkg.com/filescope-ai-sdk@latest/dist/index.js"></script>
</head>
<body>
    <h1>FileScope AI Dataset Analysis</h1>
    <input type="file" id="fileInput" accept=".csv,.xlsx,.json">
    <button onclick="analyzeFile()">Analyze Dataset</button>
    <div id="results"></div>

    <script>
        const sdk = new FileScopeSDK('your-api-key-here');
        
        async function analyzeFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file first');
                return;
            }
            
            try {
                const results = await sdk.analyzeDataset(file, { isPublic: true });
                displayResults(results);
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed: ' + error.message);
            }
        }
        
        function displayResults(results) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = \`
                <h2>Analysis Results</h2>
                <p><strong>Quality Score:</strong> \${results.quality_score}%</p>
                <p><strong>Anomalies Found:</strong> \${results.anomalies.total}</p>
                <p><strong>Data Quality:</strong> \${results.data_quality.score}%</p>
            \`;
        }
    </script>
</body>
</html>`}
                language="html"
                label="complete-example"
              />
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Core Methods</h3>
              
              <div className="space-y-8">
                <div className="border-l-4 border-blue-500 pl-6">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">analyzeDataset(file, options)</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Analyze a dataset file and get AI-powered insights
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Parameters:</h5>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">file</code> - File object or file path</li>
                      <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">options</code> - Configuration options (isPublic, analysisType, etc.)</li>
                    </ul>
                  </div>
                  <CodeBlock
                    code={`sdk.analyzeDataset(file, { isPublic: true })`}
                    language="javascript"
                    label="analyze-dataset-api"
                  />
                </div>

                <div className="border-l-4 border-green-500 pl-6">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">getResults(analysisId)</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Get analysis results by ID
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Parameters:</h5>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">analysisId</code> - Unique identifier for the analysis</li>
                    </ul>
                  </div>
                  <CodeBlock
                    code={`sdk.getResults('analysis-123')`}
                    language="javascript"
                    label="get-results-api"
                  />
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">getPublicDatasets()</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Get list of public datasets
                  </p>
                  <CodeBlock
                    code={`sdk.getPublicDatasets()`}
                    language="javascript"
                    label="get-public-datasets-api"
                  />
                </div>

                <div className="border-l-4 border-yellow-500 pl-6">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">downloadReport(analysisId)</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Download analysis report as PDF
                  </p>
                  <CodeBlock
                    code={`const report = await sdk.downloadReport('analysis-123');
const url = URL.createObjectURL(report);
const a = document.createElement('a');
a.href = url;
a.download = 'analysis-report.pdf';
a.click();`}
                    language="javascript"
                    label="download-report-api"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Response Types</h3>
              <CodeBlock
                code={`interface AnalysisResult {
  analysis_id: string;
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
  };
  insights: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  created_at: string;
  status: 'completed' | 'processing' | 'failed';
}`}
                language="typescript"
                label="response-types"
              />
            </div>
          </div>
        );

      case 'react-hook':
        return (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">React Hook Integration</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The FileScope AI SDK provides a custom React hook for easy integration in React applications. 
                This hook handles state management, API calls, and error handling automatically.
              </p>

              <CodeBlock
                code={`import { useFileScopeAnalysis } from './lib/filescope-sdk';

function MyComponent() {
  const { analyzeFile, isAnalyzing, results, error } = useFileScopeAnalysis('api-key');
  
  const handleFileUpload = async (file) => {
    try {
      const result = await analyzeFile(file);
      console.log('Analysis complete:', result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />
      {isAnalyzing && <p>Analyzing...</p>}
      {results && <p>Quality: {results.quality_score}%</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}`}
                language="typescript"
                label="react-hook-example"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Hook Return Values</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">analyzeFile(file, options?)</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Function to trigger dataset analysis
                  </p>
                  <CodeBlock
                    code={`const { analyzeFile } = useFileScopeAnalysis('api-key');

// Basic usage
await analyzeFile(file);

// With options
await analyzeFile(file, { isPublic: true, analysisType: 'comprehensive' });`}
                    language="typescript"
                    label="analyze-file-usage"
                  />
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">State Values</h4>
                  <CodeBlock
                    code={`const { 
  isAnalyzing,  // boolean - true when analysis is in progress
  results,      // AnalysisResult | null - analysis results when complete
  error,        // string | null - error message if analysis fails
  progress      // number - analysis progress (0-100)
} = useFileScopeAnalysis('api-key');`}
                    language="typescript"
                    label="state-values"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Advanced Usage</h3>
              <CodeBlock
                code={`import { useFileScopeAnalysis } from './lib/filescope-sdk';

function AdvancedComponent() {
  const { 
    analyzeFile, 
    isAnalyzing, 
    results, 
    error, 
    progress,
    reset 
  } = useFileScopeAnalysis('api-key', {
    onSuccess: (results) => {
      console.log('Analysis completed successfully:', results);
      // Send analytics, update UI, etc.
    },
    onError: (error) => {
      console.error('Analysis failed:', error);
      // Show user-friendly error message
    }
  });

  const handleFileUpload = async (file) => {
    try {
      await analyzeFile(file, {
        isPublic: true,
        analysisType: 'comprehensive',
        includeInsights: true
      });
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleReset = () => {
    reset(); // Clear all state
  };

  return (
    <div className="space-y-4">
      <input 
        type="file" 
        onChange={(e) => handleFileUpload(e.target.files[0])}
        disabled={isAnalyzing}
      />
      
      {isAnalyzing && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: \`\${progress}%\` }}
          ></div>
        </div>
      )}
      
      {results && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800">Analysis Complete!</h3>
          <p className="text-green-700">Quality Score: {results.quality_score}%</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-green-200 rounded-lg">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}
      
      <button 
        onClick={handleReset}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        Reset
      </button>
    </div>
  );
}`}
                language="typescript"
                label="advanced-usage"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Code className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              FileScope AI SDK
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Integrate powerful AI dataset analysis into your applications with our simple, powerful SDK
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">FileScope AI SDK</h2>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all">
                Get API Key
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <div className="pt-20 py-12 px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default SDKPage; 