# FileScope AI SDK

Official SDK for FileScope AI - AI-powered dataset analysis and quality assessment.

## Features

- 🚀 **Easy Integration** - Simple API calls to analyze datasets
- 🛡️ **Type Safe** - Full TypeScript support with comprehensive types
- 🤖 **AI Powered** - Advanced AI analysis for data quality, anomalies, and bias detection
- 📱 **React Ready** - Built-in React hooks for seamless integration
- 🐍 **Python Support** - Python SDK for data scientists
- 📊 **Rich Analytics** - Comprehensive data quality metrics and insights

## Installation

### JavaScript/TypeScript

```bash
# Install from GitHub
npm install github:Abidoyesimze/FileScopeAI

# Or using yarn
yarn add github:Abidoyesimze/FileScopeAI
```

### Python

```bash
# Install from GitHub
pip install git+https://github.com/Abidoyesimze/FileScopeAI.git

# Or clone and install locally
git clone https://github.com/Abidoyesimze/FileScopeAI.git
cd FileScopeAI
pip install -e .
```

## Quick Start

### JavaScript/TypeScript

```typescript
import { FileScopeSDK } from 'filescope-ai-sdk';

const sdk = new FileScopeSDK('your-api-key');

// Analyze a dataset
const results = await sdk.analyzeDataset(file, {
  isPublic: true,
  analysisType: 'comprehensive'
});

console.log('Quality Score:', results.quality_score);
console.log('Anomalies:', results.anomalies.total);
```

### React Hook

```typescript
import { useFileScopeAnalysis } from 'filescope-ai-sdk';

function MyComponent() {
  const { analyzeFile, isAnalyzing, results, error } = useFileScopeAnalysis('your-api-key');
  
  const handleUpload = async (file) => {
    await analyzeFile(file, { isPublic: true });
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isAnalyzing && <p>Analyzing...</p>}
      {results && <p>Quality: {results.quality_score}%</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### Python

```python
from filescope_ai_sdk import FileScopePythonSDK

sdk = FileScopePythonSDK('your-api-key')

# Analyze a dataset
results = sdk.analyze_dataset('data.csv', is_public=True)

print(f"Quality Score: {results['quality_score']}%")
print(f"Anomalies Found: {results['anomalies']['total']}")

# Get quality summary as DataFrame
summary_df = sdk.get_quality_summary(results)
print(summary_df)
```

## API Reference

### Core Methods

#### `analyzeDataset(file, options)`

Analyze a dataset file and get AI-powered insights.

**Parameters:**
- `file` - File object or file path
- `options` - Configuration options:
  - `isPublic` (boolean) - Whether to make the dataset public
  - `analysisType` (string) - Type of analysis: 'basic', 'comprehensive', 'custom'
  - `includeInsights` (boolean) - Whether to include detailed insights
  - `customMetrics` (array) - List of custom metrics to analyze

**Returns:** Promise<AnalysisResult>

#### `getResults(analysisId)`

Get analysis results by ID.

**Parameters:**
- `analysisId` (string) - Unique identifier for the analysis

**Returns:** Promise<AnalysisResult>

#### `getPublicDatasets()`

Get list of public datasets.

**Returns:** Promise<PublicDataset[]>

#### `downloadReport(analysisId)`

Download analysis report as PDF.

**Parameters:**
- `analysisId` (string) - The analysis ID

**Returns:** Promise<Blob>

### React Hook

#### `useFileScopeAnalysis(apiKey, options)`

React hook for easy integration.

**Parameters:**
- `apiKey` (string) - Your FileScope AI API key
- `options` (object) - Optional callbacks:
  - `onSuccess` (function) - Called when analysis completes
  - `onError` (function) - Called when analysis fails

**Returns:**
- `analyzeFile` - Function to trigger analysis
- `isAnalyzing` - Boolean indicating analysis status
- `results` - Analysis results when complete
- `error` - Error message if analysis fails
- `progress` - Analysis progress (0-100)
- `reset` - Function to clear all state

## Response Types

```typescript
interface AnalysisResult {
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
```

## Examples

### Basic Analysis

```typescript
const sdk = new FileScopeSDK('your-api-key');

// Analyze a dataset
const results = await sdk.analyzeDataset(file, {
  isPublic: true
});

console.log('Quality Score:', results.quality_score);
console.log('Anomalies:', results.anomalies.total);
```

### Advanced Analysis

```typescript
const results = await sdk.analyzeDataset(file, {
  isPublic: true,
  analysisType: 'comprehensive',
  includeInsights: true,
  customMetrics: ['bias_detection', 'outlier_analysis']
});
```

### Error Handling

```typescript
try {
  const results = await sdk.analyzeDataset(file);
  console.log('Success:', results);
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Invalid API key');
  } else if (error.message.includes('file size')) {
    console.error('File too large');
  } else {
    console.error('Analysis failed:', error.message);
  }
}
```

### Progress Tracking

```typescript
const { analyzeFile, isAnalyzing, progress } = useFileScopeAnalysis('api-key');

// Progress is automatically tracked
{isAnalyzing && (
  <div className="progress-bar">
    <div style={{ width: `${progress}%` }} />
    <span>{Math.round(progress)}%</span>
  </div>
)}
```

## Getting Started

1. **Sign up** for a FileScope AI account at [filescope.ai](https://filescope.ai)
2. **Generate an API key** in your dashboard
3. **Install the SDK** using npm, yarn, or pip
4. **Start analyzing** your datasets!

## Support

- 📚 [Documentation](https://filescope.ai/sdk)
- 💬 [Discord Community](https://discord.gg/filescope)
- 🐛 [GitHub Issues](https://github.com/filescope-ai/filescope-ai-sdk/issues)
- 📧 [Email Support](mailto:support@filescope.ai)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details. 