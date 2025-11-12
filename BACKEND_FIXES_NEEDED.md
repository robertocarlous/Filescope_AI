# Backend Fixes Needed for Analysis Results

## Issue
The frontend is receiving analysis results with all zeros and placeholder values:
- Quality scores: all 0
- Anomalies: all 0
- Bias metrics: "Unknown"
- Dataset info: empty/placeholder values

## Root Cause
The backend's `get_analysis_status` endpoint and `analyze_dataset_smart` function are not returning data in the format the frontend expects, or the data is not being saved properly.

## Required Backend Changes

### 1. Update `analyze_dataset_smart` function (in `views.py`)

**Current Issue**: The function doesn't include anomaly detection and bias analysis in its results.

**Fix Needed**: Add anomaly detection and bias analysis to the results dictionary:

```python
def analyze_dataset_smart(df, dataset_info, file_issues, depth='basic'):
    # ... existing code ...
    
    # ADD THESE LINES:
    # Perform anomaly detection and bias analysis
    from .tasks import detect_anomalies, analyze_bias
    anomaly_results = detect_anomalies(df)
    bias_results = analyze_bias(df)
    
    results = {
        'quality_score': {
            # ... existing quality_score structure ...
        },
        # ADD THIS:
        'anomaly_detection': {
            'total_anomalies': anomaly_results.get('total_anomalies', 0),
            'critical': anomaly_results.get('critical', 0),
            'moderate': anomaly_results.get('moderate', 0),
            'examples': anomaly_results.get('examples', [])
        },
        # ADD THIS:
        'bias_analysis': {
            'overall_bias_score': bias_results.get('overall_bias_score', 100),
            'bias_issues': bias_results.get('bias_issues', [])
        },
        # ... rest of existing results ...
    }
    
    return results
```

### 2. Update Upload Endpoint (in `views.py`, around line 716)

**Current Issue**: The upload endpoint doesn't save anomaly and bias data to the database.

**Fix Needed**: After calling `analyze_dataset_smart`, save the anomaly and bias data:

```python
# After line 718 (analysis.quality_score = ...)
analysis.anomaly_count = results.get('anomaly_detection', {}).get('total_anomalies', 0)
analysis.critical_anomalies = results.get('anomaly_detection', {}).get('critical', 0)
analysis.moderate_anomalies = results.get('anomaly_detection', {}).get('moderate', 0)
analysis.bias_score = float(results.get('bias_analysis', {}).get('overall_bias_score', 100))
```

**Also ensure dataset_info is saved to full_analysis**:
```python
# Before saving full_analysis, include dataset_info:
results['dataset_info'] = {
    'original_filename': file.name,
    **dataset_info
}
analysis.full_analysis = results
```

### 3. Update `get_analysis_status` endpoint (in `views.py`, around line 1744)

**Current Issue**: The endpoint doesn't return `dataset_info` and `file_health` that the frontend expects.

**Fix Needed**: Add `dataset_info` and `file_health` to the response:

```python
if analysis.status == 'completed':
    # ... existing code ...
    
    # Extract dataset_info from full_analysis
    dataset_info_raw = full_analysis.get('dataset_info', {})
    
    # ... existing results dictionary ...
    
    response['results'] = results
    
    # ADD THIS - dataset_info at root level:
    if dataset_info_raw:
        response['dataset_info'] = {
            'original_filename': dataset_info_raw.get('original_filename', os.path.basename(analysis.dataset_file.name)),
            'file_type': dataset_info_raw.get('file_type', 'Unknown'),
            'actual_content_type': dataset_info_raw.get('actual_content_type', 'unknown'),
            'rows': getattr(analysis, 'rows_count', dataset_info_raw.get('rows', 0)),
            'columns': getattr(analysis, 'columns_count', dataset_info_raw.get('columns', 0)),
            'size_bytes': dataset_info_raw.get('size_bytes', analysis.dataset_file.size if hasattr(analysis.dataset_file, 'size') else 0),
            'memory_usage_mb': dataset_info_raw.get('memory_usage_mb', 0),
            'missing_percentage': getattr(analysis, 'missing_values_pct', dataset_info_raw.get('missing_percentage', 0)),
            'has_missing_values': dataset_info_raw.get('has_missing_values', getattr(analysis, 'missing_values_pct', 0) > 0),
            'column_names': dataset_info_raw.get('column_names', []),
            'column_types': dataset_info_raw.get('column_types', {}),
            'extension_mismatch': dataset_info_raw.get('extension_mismatch', False),
        }
    else:
        # Fallback if dataset_info not in full_analysis
        response['dataset_info'] = {
            'original_filename': os.path.basename(analysis.dataset_file.name),
            'file_type': 'Unknown',
            'actual_content_type': 'unknown',
            'rows': getattr(analysis, 'rows_count', 0),
            'columns': getattr(analysis, 'columns_count', 0),
            'size_bytes': analysis.dataset_file.size if hasattr(analysis.dataset_file, 'size') else 0,
            'memory_usage_mb': 0,
            'missing_percentage': getattr(analysis, 'missing_values_pct', 0),
            'has_missing_values': getattr(analysis, 'missing_values_pct', 0) > 0,
            'column_names': [],
            'column_types': {},
            'extension_mismatch': False,
        }
    
    # ADD THIS - file_health at root level:
    file_structure = full_analysis.get('file_structure_analysis', {})
    response['file_health'] = {
        'structure_score': file_structure.get('structure_score', 100),
        'issues_detected': file_structure.get('issues_found', 0),
        'format_mismatch': dataset_info_raw.get('extension_mismatch', False) if dataset_info_raw else False,
        'can_analyze': True,
    }
```

## Expected Response Structure

After these fixes, the `get_analysis_status` endpoint should return:

```json
{
  "analysis_id": "4",
  "status": "completed",
  "metadata": { ... },
  "results": {
    "quality": {
      "overall_score": 85.5,
      "components": {
        "completeness": 90,
        "duplicates": 5,
        "schema_issues": 0
      }
    },
    "anomalies": {
      "count": 5,
      "critical": 1,
      "moderate": 2,
      "examples": [...]
    },
    "bias": {
      "score": 85,
      "assessment": "low"
    }
  },
  "dataset_info": {
    "original_filename": "election_polling_data_2024.csv",
    "file_type": "csv",
    "actual_content_type": "csv",
    "rows": 1000,
    "columns": 6,
    "size_bytes": 359000,
    "column_names": ["column1", "column2", ...],
    "column_types": {...},
    ...
  },
  "file_health": {
    "structure_score": 100,
    "issues_detected": 0,
    "format_mismatch": false,
    "can_analyze": true
  }
}
```

## Testing

After implementing these fixes:
1. Upload a test dataset
2. Check the `/api/analysis/{id}/` endpoint response
3. Verify that:
   - Quality scores are non-zero
   - Anomaly counts are present
   - Bias scores are present
   - Dataset info has real values (not placeholders)
   - Column names are populated

## Notes

- The frontend conversion function has already been updated to handle this structure
- The `detect_anomalies` and `analyze_bias` functions already exist in `tasks.py` and just need to be called
- The `dataset_info` is already being created during upload, it just needs to be saved to `full_analysis` and returned in `get_analysis_status`

