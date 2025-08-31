from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from django.core.paginator import Paginator
from django.db.models import Q
from .models import DatasetAnalysis
import mimetypes
from django.conf import settings
from .tasks import process_dataset, ALLOWED_EXTENSIONS, MAX_FILE_SIZE
from .filecoin_storage import FilecoinStorage 
import os
import uuid
import pandas as pd
import numpy as np
import json
import logging


from .tasks import (
    process_dataset,
    load_dataset,  
    get_basic_statistics,
    analyze_data_quality,
    detect_anomalies,
    analyze_bias,
    generate_insights,
    create_visualizations,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE
)
from .tasks import process_dataset
import logging
logger = logging.getLogger(__name__)


ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.xls', '.parquet', '.txt', '.tsv', '.doc', '.docx'}
MAX_FILE_SIZE = 100 * 1024 * 1024 




# @api_view(['POST'])
# def upload_dataset(request):
#     """
#     Single endpoint for upload and analysis
    
#     URL: POST /api/upload/
    
#     Query Parameters:
#     - include_visualizations: true/false (default: false)
#     - analysis_depth: basic/full (default: basic)
    
#     Form Data:
#     - file: Dataset file (required)
#     - name: Dataset name (optional)
#     - description: Dataset description (optional)
    
#     Response:
#     {
#         "success": true,
#         "analysis_id": "uuid",
#         "status": "completed",
#         "dataset_info": {
#             "name": "filename.csv",
#             "rows": 1000,
#             "columns": 25,
#             "size_bytes": 524288,
#             "file_type": "csv"
#         },
#         "results": {
#             "quality_score": {
#                 "total_score": 85.5,
#                 "grade": "B",
#                 "component_scores": {...}
#             },
#             "metrics": {...},
#             "insights": {...}
#         },
#         "visualizations": {
#             "available": ["correlation_matrix", "distribution_age"],
#             "included": false,
#             "data": {...}  // only if include_visualizations=true
#         }
#     }
#     """
#     try:
#         # Validate file upload
#         if 'file' not in request.FILES:
#             return Response({
#                 'success': false,
#                 'error': 'No file provided',
#                 'error_code': 'NO_FILE'
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         file = request.FILES['file']
#         dataset_name = request.POST.get('name', file.name)
#         dataset_description = request.POST.get('description', '')
        
#         # Get query parameters
#         include_viz = request.query_params.get('include_visualizations', 'false').lower() == 'true'
#         analysis_depth = request.query_params.get('analysis_depth', 'basic')
        
#         # Validate and process file
#         try:
#             result = process_uploaded_file(
#                 file, 
#                 dataset_name, 
#                 dataset_description,
#                 include_viz,
#                 analysis_depth,
#                 request.user if request.user.is_authenticated else None
#             )
            
#             return Response(result, status=status.HTTP_200_OK)
            
#         except ValueError as e:
#             return Response({
#                 'success': False,
#                 'error': str(e),
#                 'error_code': 'VALIDATION_ERROR'
#             }, status=status.HTTP_400_BAD_REQUEST)
            
#         except Exception as e:
#             logger.error(f"Processing error: {str(e)}")
#             return Response({
#                 'success': False,
#                 'error': 'Processing failed. Please try again.',
#                 'error_code': 'PROCESSING_ERROR'
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
#     except Exception as e:
#         logger.error(f"Upload error: {str(e)}")
#         return Response({
#             'success': False,
#             'error': 'Upload failed. Please try again.',
#             'error_code': 'UPLOAD_ERROR'
#         }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# def process_uploaded_file(file, name, description, include_viz, analysis_depth, user):
#     """
#     Process uploaded file and return complete analysis
#     """
#     file_extension = os.path.splitext(file.name)[1].lower()
#     ALLOWED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls', '.txt', '.tsv', '.parquet']
#     MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
#     if file_extension not in ALLOWED_EXTENSIONS:
#         raise ValueError(f'Unsupported file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}')
    
#     if file.size > MAX_FILE_SIZE:
#         raise ValueError(f'File too large. Maximum size: {MAX_FILE_SIZE//(1024*1024)}MB')
    
#     try:
#         df, dataset_info = load_and_validate_dataset(file, file_extension)
#     except Exception as e:
#         raise ValueError(f'Invalid file content: {str(e)}')
    
#     file_path = default_storage.save(f'datasets/{uuid.uuid4()}_{file.name}', file)
    
#     from .models import DatasetAnalysis
#     analysis = DatasetAnalysis.objects.create(
#         user=user,
#         dataset_file=file_path,
#         status='processing',
#         rows_count=dataset_info['rows'],
#         columns_count=dataset_info['columns'],
#         dataset_size=f"{dataset_info['size_bytes']} bytes"
#     )
    
#     try:
#         # Perform analysis
#         results = analyze_dataset(df, dataset_info, analysis_depth)
        
#         # Generate visualizations if requested
#         visualizations = {}
#         if include_viz:
#             visualizations = generate_visualizations(df)
        
#         # Update analysis record - using your actual model fields with JSON-safe types
#         analysis.status = 'completed'
#         analysis.quality_score = float(results['quality_score']['total_score'])
#         analysis.rows_count = int(dataset_info['rows'])
#         analysis.columns_count = int(dataset_info['columns'])
#         analysis.missing_values_pct = float(dataset_info['missing_percentage'])
#         analysis.duplicate_count = int(df.duplicated().sum())
#         analysis.full_analysis = results  # Now all values are JSON-safe
#         analysis.key_insights = {'insights': results.get('insights', [])}
#         analysis.save()
        
#         response_data = {
#             'success': True,
#             'analysis_id': str(analysis.id),
#             'status': 'completed',
#             'dataset_info': {
#                 'original_filename': file.name,
#                 **dataset_info
#             },
#             'results': results,
#             'visualizations': {
#                 'available': list(visualizations.keys()),
#                 'included': include_viz,
#                 'count': len(visualizations)
#             }
#         }
        
#         if include_viz:
#             response_data['visualizations']['data'] = visualizations
        
#         return response_data
        
#     except Exception as e:
#         analysis.status = 'failed'
#         analysis.error_message = str(e)
#         analysis.save()
#         raise e


# def load_and_validate_dataset(file, file_extension):
#     """Load dataset and extract basic information"""
    
#     file_size = file.size
    
#     if file_extension == '.csv':
#         df = pd.read_csv(file, encoding='utf-8', low_memory=False)
#     elif file_extension == '.tsv':
#         df = pd.read_csv(file, sep='\t', encoding='utf-8', low_memory=False)
#     elif file_extension == '.json':
#         df = load_json_dataset(file)
#     elif file_extension in ['.xlsx', '.xls']:
#         df = pd.read_excel(file)
#     elif file_extension == '.txt':
#         df = load_txt_dataset(file)
#     elif file_extension == '.parquet':
#         df = pd.read_parquet(file)
#     else:
#         df = pd.read_csv(file, encoding='utf-8', low_memory=False)
    
#     if df.empty:
#         raise ValueError("Dataset is empty")
    
#     if len(df.columns) == 0:
#         raise ValueError("No columns found in dataset")
    
#     dataset_info = {
#         'rows': int(len(df)),
#         'columns': int(len(df.columns)),
#         'size_bytes': int(file_size),
#         'file_type': file_extension.lstrip('.'),
#         'column_names': [str(col) for col in df.columns.tolist()],
#         'column_types': {str(col): str(dtype) for col, dtype in df.dtypes.items()},
#         'memory_usage_mb': round(float(df.memory_usage(deep=True).sum() / (1024*1024)), 2),
#         'has_missing_values': bool(df.isnull().any().any()),
#         'missing_percentage': round(float(df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 and len(df.columns) > 0 else 0, 2)
#     }
    
#     return df, dataset_info


# def load_json_dataset(file):
#     """Load JSON dataset with multiple format support"""
#     content = file.read()
#     if isinstance(content, bytes):
#         content = content.decode('utf-8')
    
#     try:
#         data = json.loads(content)
        
#         if isinstance(data, list):
#             return pd.DataFrame(data)
#         elif isinstance(data, dict):
#             if 'data' in data and isinstance(data['data'], list):
#                 return pd.DataFrame(data['data'])
#             else:
#                 return pd.DataFrame([data])
#         else:
#             raise ValueError("Unsupported JSON structure")
#     except json.JSONDecodeError as e:
#         raise ValueError(f"Invalid JSON format: {str(e)}")


# def load_txt_dataset(file):
#     """Load TXT file and attempt to detect structure"""
#     content = file.read()
#     if isinstance(content, bytes):
#         content = content.decode('utf-8', errors='ignore')
    
#     lines = content.strip().split('\n')
#     if not lines:
#         raise ValueError("Empty file")
    
#     # Try to detect separator
#     first_line = lines[0]
#     separators = ['\t', ',', '|', ';']
    
#     best_sep = None
#     max_cols = 0
    
#     for sep in separators:
#         cols = len(first_line.split(sep))
#         if cols > max_cols and cols > 1:
#             max_cols = cols
#             best_sep = sep
    
#     if best_sep and max_cols > 1:
#         from io import StringIO
#         return pd.read_csv(StringIO(content), sep=best_sep)
#     else:
#         return pd.DataFrame({'text': lines})


# def analyze_dataset(df, dataset_info, depth='basic'):
#     """Perform dataset analysis based on depth level"""
    
#     results = {
#         'quality_score': calculate_quality_score(df),
#         'basic_metrics': get_basic_metrics(df),
#         'insights': generate_basic_insights(df, dataset_info)
#     }
    
#     if depth == 'full':
#         results.update({
#             'detailed_statistics': get_detailed_statistics(df),
#             'correlation_analysis': get_correlation_analysis(df),
#             'outlier_analysis': get_outlier_analysis(df),
#             'advanced_insights': generate_advanced_insights(df)
#         })
    
#     return results


# def calculate_quality_score(df):
#     """
#     Calculate comprehensive dataset quality score (0-100)
    
#     Scoring Breakdown:
#     - Completeness: 40 points (missing data)
#     - Size Adequacy: 30 points (rows + columns) 
#     - Data Consistency: 30 points (types + naming + duplicates)
#     """
#     scores = {}
    
#     total_cells = len(df) * len(df.columns)
#     missing_cells = int(df.isnull().sum().sum())  
    
#     if total_cells > 0:
#         missing_ratio = missing_cells / total_cells
#         completeness_score = (1 - missing_ratio) * 40
#     else:
#         completeness_score = 0
    
#     scores['completeness'] = round(float(completeness_score), 2)
    
#     rows, cols = len(df), len(df.columns)
    
#     if rows >= 1000:
#         row_score = 20
#     elif rows >= 500:
#         row_score = 15
#     elif rows >= 100:
#         row_score = 10
#     elif rows >= 50:
#         row_score = 5
#     else:
#         row_score = 0
    
#     # Column adequacy (10 points max)
#     if cols >= 10:
#         col_score = 10
#     elif cols >= 5:
#         col_score = 7
#     elif cols >= 3:
#         col_score = 5
#     elif cols >= 2:
#         col_score = 3
#     else:
#         col_score = 0
    
#     size_score = row_score + col_score
#     scores['size'] = float(size_score)
    
#     consistency_total = 0
    
#     type_consistency = 0
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
    
#     for col in df.columns:
#         try:
#             if col in numeric_cols:
#                 if not df[col].isin([np.inf, -np.inf]).any():
#                     type_consistency += 1
#             else:
#                 if df[col].dtype == 'object':
#                     try:
#                         numeric_vals = pd.to_numeric(df[col], errors='coerce').notna().sum()
#                         total_vals = df[col].notna().sum()
#                         if total_vals == 0 or numeric_vals / total_vals < 0.1 or numeric_vals / total_vals > 0.9:
#                             type_consistency += 1
#                     except:
#                         type_consistency += 1
#                 else:
#                     type_consistency += 1
#         except:
#             pass
    
#     if len(df.columns) > 0:
#         type_score = (type_consistency / len(df.columns)) * 15
#     else:
#         type_score = 0
    
#     consistency_total += type_score
    
#     naming_quality = 0
#     total_naming_checks = 0
    
#     for col in df.columns:
#         col_str = str(col)
#         checks_passed = 0
        
#         if col_str.strip() == col_str:
#             checks_passed += 1
        
#         problematic_chars = ['?', '#', '@', '!', '*', '&', '%']
#         if not any(char in col_str for char in problematic_chars):
#             checks_passed += 1
        
#         if not col_str.lower().startswith('unnamed'):
#             checks_passed += 1
        
#         if len(col_str) > 0 and len(col_str) < 100:
#             checks_passed += 1
        
#         naming_quality += checks_passed
#         total_naming_checks += 4
    
#     if total_naming_checks > 0:
#         naming_score = (naming_quality / total_naming_checks) * 10
#     else:
#         naming_score = 0
    
#     consistency_total += naming_score
    
#     if len(df) > 0:
#         duplicate_count = int(df.duplicated().sum())  # Convert to Python int
#         duplicate_ratio = duplicate_count / len(df)
#         duplicate_score = (1 - duplicate_ratio) * 5
#     else:
#         duplicate_score = 0
#         duplicate_count = 0
    
#     consistency_total += duplicate_score
    
#     scores['consistency'] = round(float(consistency_total), 2)
#     scores['breakdown'] = {
#         'type_consistency': round(float(type_score), 2),
#         'naming_quality': round(float(naming_score), 2), 
#         'duplicate_penalty': round(float(duplicate_score), 2)
#     }
    
#     total_score = sum([scores['completeness'], scores['size'], scores['consistency']])
    
#     metrics = {
#         'missing_percentage': round(float((missing_cells / total_cells * 100) if total_cells > 0 else 0), 2),
#         'duplicate_percentage': round(float((duplicate_count / len(df) * 100) if len(df) > 0 else 0), 2),
#         'columns_with_missing': [str(col) for col in df.columns[df.isnull().any()].tolist()],
#         'row_count': int(rows),
#         'column_count': int(cols)
#     }
    
#     return {
#         'total_score': round(float(total_score), 1),
#         'component_scores': scores,
#         'grade': get_grade(total_score),
#         'detailed_metrics': metrics,
#         'score_explanation': {
#             'completeness_details': f"Missing {missing_cells}/{total_cells} cells ({metrics['missing_percentage']}%)",
#             'size_details': f"{rows} rows, {cols} columns",
#             'consistency_details': f"{metrics['duplicate_percentage']}% duplicates, type consistency check passed"
#         }
#     }


# def get_grade(score):
#     """Convert score to letter grade"""
#     if score >= 90: return 'A'
#     elif score >= 80: return 'B'
#     elif score >= 70: return 'C'
#     elif score >= 60: return 'D'
#     else: return 'F'


# def get_basic_metrics(df):
#     """Get basic dataset metrics with JSON-safe types"""
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     categorical_cols = df.select_dtypes(include=['object']).columns
    
#     # Convert all numpy types to Python native types for JSON serialization
#     total_missing = int(df.isnull().sum().sum())
#     duplicate_rows = int(df.duplicated().sum())
    
#     return {
#         'shape': {'rows': int(len(df)), 'columns': int(len(df.columns))},
#         'column_types': {
#             'numeric': int(len(numeric_cols)),
#             'categorical': int(len(categorical_cols)),
#             'datetime': int(len(df.select_dtypes(include=['datetime']).columns))
#         },
#         'missing_data': {
#             'total_missing': total_missing,
#             'columns_with_missing': [str(col) for col in df.columns[df.isnull().any()].tolist()],
#             'missing_percentage': round(float(total_missing / (len(df) * len(df.columns)) * 100) if len(df) > 0 and len(df.columns) > 0 else 0, 2)
#         },
#         'duplicates': {
#             'duplicate_rows': duplicate_rows,
#             'duplicate_percentage': round(float(duplicate_rows / len(df) * 100) if len(df) > 0 else 0, 2)
#         }
#     }


# def generate_basic_insights(df, dataset_info):
#     """Generate basic insights about the dataset"""
#     insights = []
    
#     missing_pct = dataset_info.get('missing_percentage', 0)
#     if missing_pct > 20:
#         insights.append(f"High missing data ({missing_pct}%) - consider data cleaning")
#     elif missing_pct > 5:
#         insights.append(f"Moderate missing data ({missing_pct}%) detected")
    
#     if len(df) < 100:
#         insights.append("Small dataset - results may have limited statistical power")
#     elif len(df) > 100000:
#         insights.append("Large dataset - consider sampling for initial exploration")
    
#     if len(df.columns) > 50:
#         insights.append("High-dimensional dataset - consider feature selection")
    
#     duplicate_pct = (df.duplicated().sum() / len(df)) * 100
#     if duplicate_pct > 10:
#         insights.append(f"High duplication ({duplicate_pct:.1f}%) - consider deduplication")
    
#     return insights


# def generate_visualizations(df):
#     """Generate basic visualizations (placeholder - implement with matplotlib/plotly)"""
#     visualizations = {}
    
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     categorical_cols = df.select_dtypes(include=['object']).columns
    
    
#     for col in numeric_cols[:5]:  # First 5 numeric columns
#         visualizations[f'distribution_{col}'] = {
#             'type': 'histogram',
#             'description': f'Distribution of {col}',
#             'data': None  # Would contain actual chart data/image
#         }
    
#     if len(numeric_cols) > 1:
#         visualizations['correlation_matrix'] = {
#             'type': 'heatmap',
#             'description': 'Correlation matrix of numeric variables',
#             'data': None
#         }
    
#     for col in categorical_cols[:3]:  # First 3 categorical columns
#         if df[col].nunique() <= 20:  # Only for columns with reasonable number of categories
#             visualizations[f'bar_{col}'] = {
#                 'type': 'bar',
#                 'description': f'Distribution of {col}',
#                 'data': None
#             }
    
#     return visualizations

import mammoth
import json
import pandas as pd
import numpy as np
import os
import uuid
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import logging
from io import StringIO

logger = logging.getLogger(__name__)

# Configuration
ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.xls', '.parquet', '.txt', '.tsv', '.doc', '.docx'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

@api_view(['POST'])
def upload_dataset(request):
    """
    Enhanced upload endpoint that handles file format mismatches gracefully
    
    URL: POST /api/upload/
    
    Query Parameters:
    - include_visualizations: true/false (default: false)
    - analysis_depth: basic/full (default: basic)
    - strict_format: true/false (default: false)
    
    Form Data:
    - file: Dataset file (required)
    - name: Dataset name (optional)
    - description: Dataset description (optional)
    """
    try:
        if 'file' not in request.FILES:
            return Response({
                'success': False,
                'error': 'No file provided',
                'error_code': 'NO_FILE'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        dataset_name = request.POST.get('name', file.name)
        dataset_description = request.POST.get('description', '')
        
        # Get query parameters
        include_viz = request.query_params.get('include_visualizations', 'false').lower() == 'true'
        analysis_depth = request.query_params.get('analysis_depth', 'basic')
        strict_format = request.query_params.get('strict_format', 'false').lower() == 'true'
        
        try:
            result = process_uploaded_file_smart(
                file, 
                dataset_name, 
                dataset_description,
                include_viz,
                analysis_depth,
                strict_format,
                request.user if request.user.is_authenticated else None
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
                'error_code': 'VALIDATION_ERROR'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Processing error: {str(e)}")
            return Response({
                'success': False,
                'error': 'Processing failed. Please try again.',
                'error_code': 'PROCESSING_ERROR'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Upload failed. Please try again.',
            'error_code': 'UPLOAD_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def process_uploaded_file_smart(file, name, description, include_viz, analysis_depth, strict_format, user):
    """
    Smart file processing that handles format mismatches and content detection
    """
    file_extension = os.path.splitext(file.name)[1].lower()
    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Unsupported file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}')
    
    if file.size > MAX_FILE_SIZE:
        raise ValueError(f'File too large. Maximum size: {MAX_FILE_SIZE//(1024*1024)}MB')
    
    # Smart content detection and parsing
    df, dataset_info, file_issues = smart_file_parser(file, file_extension)
    
    # If strict_format is enabled, fail on major format mismatches
    if strict_format and any(issue['severity'] == 'high' for issue in file_issues):
        major_issues = [issue['message'] for issue in file_issues if issue['severity'] == 'high']
        raise ValueError(f"Strict format validation failed: {'; '.join(major_issues)}")
    
    # Store file and create analysis record
    file_path = default_storage.save(f'datasets/{uuid.uuid4()}_{file.name}', file)
    
    # Import your models here (adjust import path as needed)
    from .models import DatasetAnalysis
    
    analysis = DatasetAnalysis.objects.create(
        user=user,
        dataset_file=file_path,
        status='processing',
        rows_count=dataset_info['rows'],
        columns_count=dataset_info['columns'],
        dataset_size=f"{dataset_info['size_bytes']} bytes"
    )
    
    try:
        # Perform analysis with file issues context
        results = analyze_dataset_smart(df, dataset_info, file_issues, analysis_depth)
        
        # Generate visualizations if requested
        visualizations = {}
        if include_viz:
            visualizations = generate_visualizations_smart(df, file_issues)
        
        # Update analysis record
        analysis.status = 'completed'
        analysis.quality_score = float(results['quality_score']['total_score'])
        analysis.rows_count = int(dataset_info['rows'])
        analysis.columns_count = int(dataset_info['columns'])
        analysis.missing_values_pct = float(dataset_info.get('missing_percentage', 0))
        analysis.duplicate_count = int(df.duplicated().sum())
        analysis.full_analysis = results
        
        # Include file issues in insights
        all_insights = results.get('insights', [])
        if file_issues:
            issue_insights = [f"📁 {issue['message']}" for issue in file_issues if issue['severity'] in ['high', 'medium']]
            all_insights = issue_insights + all_insights
        
        analysis.key_insights = {'insights': all_insights}
        analysis.save()
        
        response_data = {
            'success': True,
            'analysis_id': str(analysis.id),
            'status': 'completed',
            'dataset_info': {
                'original_filename': file.name,
                **dataset_info
            },
            'results': results,
            'file_health': {
                'structure_score': 100 - len([i for i in file_issues if i['severity'] in ['high', 'medium']]) * 10,
                'issues_detected': len(file_issues),
                'format_mismatch': any(issue['type'] == 'extension_mismatch' for issue in file_issues),
                'can_analyze': True
            },
            'visualizations': {
                'available': list(visualizations.keys()) if visualizations else [],
                'included': include_viz,
                'count': len(visualizations) if visualizations else 0
            }
        }
        
        if include_viz:
            response_data['visualizations']['data'] = visualizations
        
        return response_data
        
    except Exception as e:
        analysis.status = 'failed'
        analysis.error_message = str(e)
        analysis.save()
        raise e


def smart_file_parser(file, declared_extension):
    """
    Smart parser that detects actual content type and handles mismatches
    """
    file.seek(0)
    file_content = file.read()
    file.seek(0)
    
    if isinstance(file_content, bytes):
        try:
            content_str = file_content.decode('utf-8')
        except UnicodeDecodeError:
            content_str = file_content.decode('utf-8', errors='ignore')
    else:
        content_str = str(file_content)
    
    content_preview = content_str[:2000].strip()
    file_issues = []
    df = None
    actual_content_type = None
    
    # 1. Try JSON parsing first (handles package.json as CSV case)
    if content_preview.startswith(('{', '[')):
        try:
            data = json.loads(content_str)
            actual_content_type = 'json'
            
            if declared_extension != '.json':
                file_issues.append({
                    'type': 'extension_mismatch',
                    'severity': 'medium',
                    'message': f'File contains JSON but has {declared_extension} extension',
                    'recommendation': f'Consider renaming to .json'
                })
            
            # Handle different JSON structures
            if isinstance(data, dict):
                if 'name' in data and 'version' in data:
                    # Package.json or similar config
                    file_issues.append({
                        'type': 'config_file_detected',
                        'severity': 'info',
                        'message': 'Configuration file (package.json style) detected',
                        'recommendation': 'Data will be flattened for analysis'
                    })
                    df = pd.DataFrame([flatten_json_object(data)])
                else:
                    # Regular JSON object
                    df = pd.DataFrame([data])
            elif isinstance(data, list) and data:
                if isinstance(data[0], dict):
                    df = pd.DataFrame(data)
                else:
                    df = pd.DataFrame({'items': data})
            else:
                df = pd.DataFrame({'value': [data]})
                
        except json.JSONDecodeError:
            pass
    
    # 2. Try CSV parsing (handles CSV as JSON case)
    if df is None:
        try:
            # Quick CSV detection
            lines = content_preview.split('\n')[:10]
            comma_counts = [line.count(',') for line in lines if line.strip()]
            
            if comma_counts and max(comma_counts) >= 1:
                df = pd.read_csv(StringIO(content_str))
                actual_content_type = 'csv'
                
                if declared_extension != '.csv':
                    file_issues.append({
                        'type': 'extension_mismatch',
                        'severity': 'medium',
                        'message': f'File contains CSV data but has {declared_extension} extension',
                        'recommendation': 'Consider renaming to .csv'
                    })
                
                # Check for analysis report format
                if len(df) > 0 and any('Analysis Report' in str(cell) for cell in df.iloc[:3, :].values.flatten()):
                    file_issues.append({
                        'type': 'report_format',
                        'severity': 'info',
                        'message': 'Analysis report format detected',
                        'recommendation': 'Will extract structured data from report'
                    })
                    df = parse_analysis_report(content_str)
                    
        except Exception as parse_error:
            logger.debug(f"CSV parsing failed: {parse_error}")
    
    # 3. Try Excel formats
    if df is None and declared_extension in ['.xlsx', '.xls']:
        try:
            df = pd.read_excel(file)
            actual_content_type = 'excel'
        except Exception as excel_error:
            logger.debug(f"Excel parsing failed: {excel_error}")
    
    # 4. Try document formats
    if df is None and declared_extension in ['.doc', '.docx']:
        try:
            if declared_extension == '.docx':
                with file.open('rb') as doc_file:
                    result = mammoth.extract_raw_text(doc_file)
                    text_lines = result.value.split('\n')
            else:
                # Basic .doc handling (would need python-docx2txt or similar for full support)
                text_lines = content_str.split('\n')
            
            df = pd.DataFrame({
                'line_number': range(1, len(text_lines) + 1),
                'content': text_lines,
                'char_count': [len(line) for line in text_lines]
            })
            actual_content_type = 'document'
            
            file_issues.append({
                'type': 'document_parsed',
                'severity': 'info',
                'message': 'Document converted to line-by-line analysis format',
                'recommendation': 'Text content extracted for analysis'
            })
            
        except Exception as doc_error:
            logger.debug(f"Document parsing failed: {doc_error}")
    
    # 5. Fallback to text analysis
    if df is None:
        lines = content_str.split('\n')[:1000]  # Limit to first 1000 lines
        df = pd.DataFrame({
            'line_number': range(1, len(lines) + 1),
            'content': lines,
            'char_count': [len(line) for line in lines],
            'is_empty': [line.strip() == '' for line in lines]
        })
        actual_content_type = 'text'
        
        file_issues.append({
            'type': 'fallback_parsing',
            'severity': 'medium',
            'message': 'Could not detect specific format, parsed as text',
            'recommendation': 'Verify file format and content'
        })
    
    if df is None or df.empty:
        raise ValueError("Unable to extract any data from the file")
    
    # Create dataset info
    dataset_info = {
        'rows': len(df),
        'columns': len(df.columns),
        'size_bytes': file.size,
        'file_type': declared_extension.lstrip('.'),
        'actual_content_type': actual_content_type,
        'extension_mismatch': actual_content_type != declared_extension.lstrip('.'),
        'column_names': df.columns.tolist(),
        'column_types': {col: str(dtype) for col, dtype in df.dtypes.items()},
        'memory_usage_mb': round(df.memory_usage(deep=True).sum() / (1024*1024), 2),
        'has_missing_values': df.isnull().any().any(),
        'missing_percentage': round(df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100, 2) if len(df) > 0 and len(df.columns) > 0 else 0
    }
    
    return df, dataset_info, file_issues


def flatten_json_object(obj, prefix=''):
    """
    Flatten a JSON object for tabular analysis
    """
    flattened = {}
    
    for key, value in obj.items():
        full_key = f"{prefix}{key}" if prefix else key
        
        if isinstance(value, dict):
            # Count nested items and flatten important ones
            flattened[f"{full_key}_count"] = len(value)
            if len(value) <= 10:  # Only flatten small objects
                nested = flatten_json_object(value, f"{full_key}_")
                flattened.update(nested)
            else:
                # Just store keys for large objects
                flattened[f"{full_key}_keys"] = ', '.join(list(value.keys())[:5])
        elif isinstance(value, list):
            flattened[f"{full_key}_count"] = len(value)
            if value and len(value) <= 5:
                flattened[f"{full_key}_items"] = ', '.join(str(v) for v in value[:3])
        else:
            # Store the actual value, truncated if too long
            str_value = str(value)
            flattened[full_key] = str_value[:200] if len(str_value) > 200 else str_value
    
    return flattened


def parse_analysis_report(content_str):
    """
    Parse CSV-formatted analysis reports into structured data
    """
    lines = content_str.strip().split('\n')
    
    parsed_data = {
        'section': [],
        'metric': [],
        'value': [],
        'line_number': []
    }
    
    current_section = 'header'
    
    for i, line in enumerate(lines, 1):
        line = line.strip().strip('"')
        
        if not line:
            continue
        
        # Detect section headers
        if line in ['Dataset Information', 'Quality Metrics', 'Anomalies', 'Detailed Anomalies', 'Bias Metrics', 'AI Insights']:
            current_section = line.lower().replace(' ', '_')
            continue
        
        # Parse data rows
        if ',' in line:
            parts = [p.strip().strip('"') for p in line.split(',', 1)]  # Split on first comma only
            if len(parts) >= 2 and parts[0] and parts[1]:
                parsed_data['section'].append(current_section)
                parsed_data['metric'].append(parts[0])
                parsed_data['value'].append(parts[1])
                parsed_data['line_number'].append(i)
        else:
            # Single column data
            parsed_data['section'].append(current_section)
            parsed_data['metric'].append('content')
            parsed_data['value'].append(line)
            parsed_data['line_number'].append(i)
    
    return pd.DataFrame(parsed_data) if parsed_data['metric'] else pd.DataFrame({'content': lines})


def analyze_dataset_smart(df, dataset_info, file_issues, depth='basic'):
    """
    Smart analysis that adapts to different content types and file issues
    """
    # Calculate quality score with file issue penalties
    base_score = calculate_base_quality_score(df)
    issue_penalty = sum(10 if issue['severity'] == 'high' else 5 if issue['severity'] == 'medium' else 1 
                       for issue in file_issues)
    final_score = max(base_score - issue_penalty, 0)
    
    results = {
        'quality_score': {
            'total_score': final_score,
            'base_score': base_score,
            'issue_penalty': issue_penalty,
            'grade': get_score_grade(final_score),
            'component_scores': {
                'completeness': calculate_completeness_score(df),
                'consistency': calculate_consistency_score(df),
                'format_compliance': max(100 - issue_penalty, 0)
            }
        },
        'basic_metrics': get_smart_basic_metrics(df, dataset_info),
        'file_structure_analysis': {
            'issues_found': len(file_issues),
            'extension_mismatch': dataset_info.get('extension_mismatch', False),
            'actual_content_type': dataset_info.get('actual_content_type', 'unknown'),
            'issues_by_severity': {
                'high': len([i for i in file_issues if i['severity'] == 'high']),
                'medium': len([i for i in file_issues if i['severity'] == 'medium']),
                'low': len([i for i in file_issues if i['severity'] == 'low']),
                'info': len([i for i in file_issues if i['severity'] == 'info'])
            },
            'detailed_issues': file_issues
        },
        'insights': generate_smart_insights(df, dataset_info, file_issues)
    }
    
    # Add detailed analysis for full depth
    if depth == 'full':
        results.update({
            'detailed_statistics': get_detailed_statistics(df),
            'content_analysis': analyze_content_type(df, dataset_info),
            'recommendations': generate_recommendations(df, dataset_info, file_issues)
        })
    
    return results


def calculate_base_quality_score(df):
    """Calculate basic quality score from DataFrame"""
    if df.empty:
        return 0
    
    completeness = (1 - df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100
    consistency = calculate_consistency_score(df)
    
    return round((completeness + consistency) / 2, 1)


def calculate_completeness_score(df):
    """Calculate data completeness score"""
    if df.empty:
        return 0
    
    total_cells = len(df) * len(df.columns)
    missing_cells = df.isnull().sum().sum()
    return round((1 - missing_cells / total_cells) * 100, 1)


def calculate_consistency_score(df):
    """Calculate data consistency score"""
    if df.empty:
        return 0
    
    scores = []
    
    for col in df.columns:
        if df[col].dtype in ['object']:
            # Check for consistent string formats
            non_null = df[col].dropna()
            if len(non_null) > 0:
                unique_ratio = len(non_null.unique()) / len(non_null)
                consistency = (1 - unique_ratio) * 100 if unique_ratio > 0.8 else 80
                scores.append(consistency)
        else:
            # Numeric columns get higher consistency scores
            scores.append(90)
    
    return round(sum(scores) / len(scores), 1) if scores else 50


def get_score_grade(score):
    """Convert numeric score to letter grade"""
    if score >= 90:
        return 'A'
    elif score >= 80:
        return 'B'
    elif score >= 70:
        return 'C'
    elif score >= 60:
        return 'D'
    else:
        return 'F'


def get_smart_basic_metrics(df, dataset_info):
    """Get basic metrics adapted to content type"""
    metrics = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'memory_usage_mb': dataset_info.get('memory_usage_mb', 0),
        'missing_values_count': int(df.isnull().sum().sum()),
        'missing_percentage': dataset_info.get('missing_percentage', 0),
        'duplicate_rows': int(df.duplicated().sum()),
        'content_type': dataset_info.get('actual_content_type', 'unknown')
    }
    
    # Add type-specific metrics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    text_cols = df.select_dtypes(include=['object']).columns
    
    metrics.update({
        'numeric_columns': len(numeric_cols),
        'text_columns': len(text_cols),
        'column_types': {col: str(dtype) for col, dtype in df.dtypes.items()}
    })
    
    return metrics


def analyze_content_type(df, dataset_info):
    """Analyze content based on detected type"""
    content_type = dataset_info.get('actual_content_type', 'unknown')
    
    analysis = {
        'detected_type': content_type,
        'structure_analysis': {}
    }
    
    if content_type == 'json':
        # JSON-specific analysis
        if 'name' in df.columns and 'version' in df.columns:
            analysis['structure_analysis'] = {
                'type': 'configuration_file',
                'pattern': 'package.json or similar',
                'key_fields': [col for col in df.columns if col in ['name', 'version', 'description']]
            }
        else:
            analysis['structure_analysis'] = {
                'type': 'data_object',
                'complexity': 'simple' if len(df.columns) <= 10 else 'complex'
            }
    
    elif content_type == 'document':
        # Document analysis
        if 'content' in df.columns:
            analysis['structure_analysis'] = {
                'type': 'text_document',
                'total_lines': len(df),
                'avg_line_length': df['content'].str.len().mean(),
                'empty_lines': len(df[df['content'].str.strip() == ''])
            }
    
    elif content_type == 'csv':
        # CSV analysis
        analysis['structure_analysis'] = {
            'type': 'tabular_data',
            'well_formed': not any('Unnamed:' in str(col) for col in df.columns),
            'numeric_ratio': len(df.select_dtypes(include=[np.number]).columns) / len(df.columns)
        }
    
    return analysis


def generate_smart_insights(df, dataset_info, file_issues):
    """Generate insights based on file analysis"""
    insights = []
    
    # File format insights
    if file_issues:
        format_issues = [issue for issue in file_issues if issue['type'] == 'extension_mismatch']
        if format_issues:
            insights.append("📁 File extension doesn't match content - consider renaming for better tool compatibility")
        
        config_files = [issue for issue in file_issues if issue['type'] == 'config_file_detected']
        if config_files:
            insights.append("⚙️ Configuration file detected - analysis adapted for non-tabular data structure")
    
    # Data quality insights
    missing_pct = dataset_info.get('missing_percentage', 0)
    if missing_pct > 20:
        insights.append(f"⚠️ High missing data rate ({missing_pct:.1f}%) - may impact analysis quality")
    elif missing_pct < 5:
        insights.append("✅ Low missing data rate - good data quality")
    
    # Content type insights
    content_type = dataset_info.get('actual_content_type', 'unknown')
    if content_type == 'json':
        insights.append("📋 JSON structure detected - data flattened for tabular analysis")
    elif content_type == 'document':
        insights.append("📄 Document content extracted - analyzing text structure and patterns")
    
    # Size insights
    if len(df) < 100:
        insights.append("📊 Small dataset - results may have limited statistical significance")
    elif len(df) > 10000:
        insights.append("📈 Large dataset detected - comprehensive analysis possible")
    
    return insights


def generate_recommendations(df, dataset_info, file_issues):
    """Generate actionable recommendations"""
    recommendations = []
    
    # Format recommendations
    if any(issue['type'] == 'extension_mismatch' for issue in file_issues):
        recommendations.append({
            'category': 'Format',
            'priority': 'Medium',
            'action': 'Rename file with correct extension',
            'reason': 'Improves compatibility with other data tools'
        })
    
    # Data quality recommendations
    missing_pct = dataset_info.get('missing_percentage', 0)
    if missing_pct > 10:
        recommendations.append({
            'category': 'Data Quality',
            'priority': 'High',
            'action': 'Address missing data before analysis',
            'reason': f'High missing rate ({missing_pct:.1f}%) may skew results'
        })
    
    # Content-specific recommendations
    content_type = dataset_info.get('actual_content_type', 'unknown')
    if content_type == 'json' and 'name' in df.columns:
        recommendations.append({
            'category': 'Analysis',
            'priority': 'Info',
            'action': 'Consider specialized config file analysis',
            'reason': 'This appears to be a configuration file with specific structure'
        })
    
    return recommendations


def generate_visualizations_smart(df, file_issues):
    """Generate visualizations adapted to content and issues"""
    visualizations = {}
    
    # File issues visualization
    if file_issues:
        severity_counts = {}
        for issue in file_issues:
            severity = issue['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        visualizations['file_issues'] = {
            'type': 'bar_chart',
            'title': 'File Structure Issues by Severity',
            'data': severity_counts,
            'description': 'Distribution of detected file format and structure issues'
        }
    
    # Standard data visualizations (only for tabular data)
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        # Distribution plots for numeric columns
        for col in numeric_cols[:3]:  # Limit to first 3
            visualizations[f'dist_{col}'] = {
                'type': 'histogram',
                'title': f'Distribution of {col}',
                'column': col,
                'description': f'Frequency distribution of values in {col}'
            }
        
        # Correlation matrix if multiple numeric columns
        if len(numeric_cols) > 1:
            visualizations['correlation'] = {
                'type': 'heatmap',
                'title': 'Numeric Variable Correlations',
                'description': 'Correlation matrix of numeric variables'
            }
    
    # Missing data visualization
    if df.isnull().any().any():
        visualizations['missing_data'] = {
            'type': 'bar_chart',
            'title': 'Missing Data by Column',
            'description': 'Count of missing values per column'
        }
    
    return visualizations


def get_detailed_statistics(df):
    """Get detailed statistical analysis"""
    stats = {}
    
    # Numeric column statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        stats['numeric_summary'] = df[numeric_cols].describe().to_dict()
    
    # Text column statistics
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        stats['text_summary'] = {}
        for col in text_cols:
            stats['text_summary'][col] = {
                'unique_values': int(df[col].nunique()),
                'most_common': df[col].value_counts().head(3).to_dict(),
                'avg_length': float(df[col].astype(str).str.len().mean())
            }
    
    return stats


@api_view(['POST'])
def validate_file_format(request):
    """
    Validate file format without full processing
    URL: POST /api/validate/
    """
    try:
        if 'file' not in request.FILES:
            return Response({
                'success': False,
                'error': 'No file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        file_extension = os.path.splitext(file.name)[1].lower()
        
        if file_extension not in ALLOWED_EXTENSIONS:
            return Response({
                'success': False,
                'error': f'Unsupported file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Quick validation using smart parser
        try:
            _, dataset_info, file_issues = smart_file_parser(file, file_extension)
            
            return Response({
                'success': True,
                'validation_results': {
                    'filename': file.name,
                    'declared_extension': file_extension,
                    'detected_content_type': dataset_info.get('actual_content_type', 'unknown'),
                    'extension_mismatch': dataset_info.get('extension_mismatch', False),
                    'can_parse': True,
                    'file_size_mb': round(file.size / (1024*1024), 2),
                    'issues_found': len(file_issues),
                    'structure_analysis': {
                        'issues_by_severity': {
                            'high': len([i for i in file_issues if i['severity'] == 'high']),
                            'medium': len([i for i in file_issues if i['severity'] == 'medium']),
                            'low': len([i for i in file_issues if i['severity'] == 'low']),
                            'info': len([i for i in file_issues if i['severity'] == 'info'])
                        },
                        'detailed_issues': file_issues
                    },
                    'recommendations': {
                        'proceed_with_analysis': True,
                        'suggested_actions': [issue['recommendation'] for issue in file_issues if issue['severity'] in ['high', 'medium']],
                        'analysis_notes': generate_analysis_notes(dataset_info, file_issues)
                    }
                }
            })
            
        except Exception as validation_error:
            return Response({
                'success': False,
                'error': f'Validation failed: {str(validation_error)}',
                'error_code': 'VALIDATION_ERROR'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Validation failed. Please try again.',
            'error_code': 'VALIDATION_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def generate_analysis_notes(dataset_info, file_issues):
    """Generate human-readable analysis notes"""
    notes = []
    
    if file_issues:
        if any(issue['severity'] == 'high' for issue in file_issues):
            notes.append("⚠️ Critical issues detected but file can still be processed")
        elif any(issue['severity'] == 'medium' for issue in file_issues):
            notes.append("⚠️ Format issues detected but analysis will proceed")
        else:
            notes.append("ℹ️ Minor format notes - no impact on analysis quality")
    else:
        notes.append("✅ File structure is valid and properly formatted")
    
    content_type = dataset_info.get('actual_content_type', 'unknown')
    declared_type = dataset_info.get('file_type', 'unknown')
    
    if content_type != declared_type:
        notes.append(f"🔄 Content will be processed as {content_type} (not {declared_type})")
    else:
        notes.append(f"✅ Content matches declared format ({content_type})")
    
    return notes


# Helper function to detect actual content type from file content
def detect_actual_content_type(file_content, declared_extension):
    """
    Detect the actual content type regardless of file extension
    """
    if isinstance(file_content, bytes):
        try:
            content_str = file_content.decode('utf-8')
        except UnicodeDecodeError:
            return 'binary'
    else:
        content_str = str(file_content)
    
    content_preview = content_str[:1000].strip()
    
    # JSON detection
    if content_preview.startswith(('{', '[')):
        try:
            json.loads(content_str)
            return 'json'
        except json.JSONDecodeError:
            pass
    
    # CSV detection
    lines = content_preview.split('\n')[:5]
    csv_score = sum(1 for line in lines if line.count(',') >= 2)
    if csv_score >= 2:
        return 'csv'
    
    # TSV detection
    tsv_score = sum(1 for line in lines if line.count('\t') >= 2)
    if tsv_score >= 2:
        return 'tsv'
    
    # Document detection
    if declared_extension in ['.doc', '.docx']:
        return 'document'
    
    # Default to text
    return 'text'


# Quick test function to verify your specific case
def test_package_json_as_csv():
    """
    Test function for your specific case: package.json uploaded as .csv
    """
    test_content = '{"name": "test", "version": "1.0.0"}'
    
    # Simulate file upload
    from django.core.files.uploadedfile import SimpleUploadedFile
    test_file = SimpleUploadedFile("test.csv", test_content.encode(), content_type="text/csv")
    
    try:
        df, dataset_info, file_issues = smart_file_parser(test_file, '.csv')
        print("✅ Parsing successful!")
        print(f"DataFrame shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        print(f"Issues detected: {len(file_issues)}")
        for issue in file_issues:
            print(f"  - {issue['severity']}: {issue['message']}")
        return True
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

@api_view(['GET'])
def list_user_analyses(request):
    """
    List all analyses for the authenticated user
    """
    try:
        analyses = DatasetAnalysis.objects.filter(user=request.user).order_by('-uploaded_at')
        
        page = request.GET.get('page', 1)
        per_page = min(int(request.GET.get('per_page', 10)), 50) 
        
        paginator = Paginator(analyses, per_page)
        page_obj = paginator.get_page(page)
        
        analyses_data = []
        for analysis in page_obj:
            analyses_data.append({
                'analysis_id': str(analysis.id),
                'status': analysis.status,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'dataset_size': analysis.dataset_size,
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'has_filecoin_storage': bool(analysis.analysis_cid),
                'verification_url': analysis.verification_url
            })
        
        return Response({
            'analyses': analyses_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve analyses: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
def delete_analysis(request, analysis_id):
    """
    Delete an analysis
    """
    try:
        analysis = DatasetAnalysis.objects.get(
            id=analysis_id, 
            user=request.user
        )
        
        if analysis.dataset_file:
            try:
                default_storage.delete(analysis.dataset_file.name)
            except Exception as e:
                pass
        
        analysis.delete()
        
        return Response({
            'message': 'Analysis deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except DatasetAnalysis.DoesNotExist:
        return Response(
            {'error': 'Analysis not found or access denied'}, 
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['GET'])
def get_public_analysis(request, analysis_cid):
    """
    Get public analysis results from Filecoin CID
    """
    try:
        # Find analysis by CID
        analysis = DatasetAnalysis.objects.filter(analysis_cid=analysis_cid).first()
        
        if not analysis:
            return Response(
                {'error': 'Analysis not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if analysis.status != 'completed':
            return Response(
                {'error': 'Analysis not completed'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'analysis_cid': analysis.analysis_cid,
            'dataset_cid': analysis.dataset_cid,
            'uploaded_at': analysis.uploaded_at.isoformat(),
            'dataset_size': analysis.dataset_size,
            'results': {
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'insights': analysis.key_insights,
                'visualization_data': analysis.visualization_data,
            },
            'verification_url': analysis.verification_url,
            'filecoin_verified': True
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve public analysis: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def browse_public_datasets(request):
    """
    Browse public datasets with analysis results
    """
    try:
        analyses = DatasetAnalysis.objects.filter(
            status='completed',
            analysis_cid__isnull=False
        ).exclude(analysis_cid='').order_by('-uploaded_at')
        
        quality_min = request.GET.get('quality_min')
        if quality_min:
            analyses = analyses.filter(quality_score__gte=float(quality_min))
        
        bias_max = request.GET.get('bias_max')
        if bias_max:
            analyses = analyses.filter(bias_score__lte=float(bias_max))
        
        search = request.GET.get('search')
        if search:
            analyses = analyses.filter(
                Q(key_insights__icontains=search) |
                Q(dataset_size__icontains=search)
            )
        
        # Pagination
        page = request.GET.get('page', 1)
        per_page = min(int(request.GET.get('per_page', 20)), 50)
        
        paginator = Paginator(analyses, per_page)
        page_obj = paginator.get_page(page)
        
        datasets_data = []
        for analysis in page_obj:
            datasets_data.append({
                'analysis_cid': analysis.analysis_cid,
                'dataset_cid': analysis.dataset_cid,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'dataset_size': analysis.dataset_size,
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'verification_url': analysis.verification_url,
                'summary': analysis.key_insights.get('summary', '') if analysis.key_insights else ''
            })
        
        return Response({
            'datasets': datasets_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            },
            'filters_applied': {
                'quality_min': quality_min,
                'bias_max': bias_max,
                'search': search
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to browse datasets: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# @api_view(['GET'])
# def get_platform_stats(request):
#     """
#     Get platform statistics
#     """
#     try:
#         total_analyses = DatasetAnalysis.objects.count()
#         completed_analyses = DatasetAnalysis.objects.filter(status='completed').count()
#         failed_analyses = DatasetAnalysis.objects.filter(status='failed').count()
#         processing_analyses = DatasetAnalysis.objects.filter(status='processing').count()
        
#         # Filecoin storage stats
#         stored_on_filecoin = DatasetAnalysis.objects.filter(
#             analysis_cid__isnull=False
#         ).exclude(analysis_cid='').count()
        
#         # Quality stats
#         avg_quality = DatasetAnalysis.objects.filter(
#             quality_score__isnull=False
#         ).aggregate(avg_quality=models.Avg('quality_score'))['avg_quality']
        
#         return Response({
#             'total_datasets_analyzed': total_analyses,
#             'completed_analyses': completed_analyses,
#             'failed_analyses': failed_analyses,
#             'currently_processing': processing_analyses,
#             'stored_on_filecoin': stored_on_filecoin,
#             'average_quality_score': round(avg_quality, 2) if avg_quality else None,
#             'success_rate': round((completed_analyses / total_analyses * 100), 2) if total_analyses > 0 else 0
#         })
        
#     except Exception as e:
#         return Response(
#             {'error': f'Failed to retrieve platform stats: {str(e)}'}, 
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#         )


# @api_view(['GET'])
# def get_analysis_status(request, analysis_id):
#     """
#     Get analysis status and results
#     """
#     try:
#         analysis = get_object_or_404(DatasetAnalysis, id=analysis_id)
        
#         response_data = {
#             'analysis_id': str(analysis.id),
#             'status': analysis.status,
#             'uploaded_at': analysis.uploaded_at.isoformat(),
#             'file_name': os.path.basename(analysis.dataset_file.name),
#         }
        
#         if analysis.status == 'completed':
#             response_data['results'] = results
        
#         return Response(response_data)
        
#     except Exception as e:
#         return Response(
#             {'error': str(e)},
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#  
#        )




@api_view(['GET'])
def get_analysis_status(request, analysis_id):
    try:
        analysis = get_object_or_404(DatasetAnalysis, id=analysis_id)
        
        response = {
            'metadata': {
                'analysis_id': str(analysis.id),
                'status': analysis.status,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'file_name': os.path.basename(analysis.dataset_file.name),
                'processing_time': getattr(analysis, 'processing_time', 'N/A'),
                'dimensions': {
                    'rows': getattr(analysis, 'rows_count', 0),
                    'columns': getattr(analysis, 'columns_count', 0)
                }
            }
        }

        if analysis.status == 'completed':
            # Get the complete stored analysis or empty dict if none
            full_analysis = getattr(analysis, 'full_analysis', {})
            visualization_data = getattr(analysis, 'visualization_data', {})
            
            results = {
                # 1. Dataset Summary/Metadata
                'dataset_profile': {
                    'data_types': full_analysis.get('data_types', {}),
                    'completeness': full_analysis.get('completeness', {}),
                    'sample_values': full_analysis.get('sample_values', {})
                },
                
                # 2. Anomaly Detection
                'anomalies': {
                    'count': getattr(analysis, 'anomaly_count', 0),
                    'critical': getattr(analysis, 'critical_anomalies', 0),
                    'moderate': getattr(analysis, 'moderate_anomalies', 0),
                    'method': full_analysis.get('anomaly_method', 'Isolation Forest'),
                    'examples': full_analysis.get('anomaly_examples', [])
                },
                
                # 3. Bias Assessment
                'bias': {
                    'score': getattr(analysis, 'bias_score', 100),
                    'assessment': "not assessed" if analysis.bias_score is None
                                else "high" if analysis.bias_score < 70
                                else "moderate" if analysis.bias_score < 85
                                else "low",
                    'imbalanced_fields': full_analysis.get('imbalanced_fields', {})
                },
                
                # 4. Quality Scoring
                'quality': {
                    'overall_score': getattr(analysis, 'quality_score', 100),
                    'components': {
                        'completeness': full_analysis.get('completeness_score', 100),
                        'duplicates': full_analysis.get('duplicate_percentage', 0),
                        'schema_issues': full_analysis.get('schema_violations', 0)
                    }
                },
                
                # 5-12. Other Analysis Components
                'advanced_analysis': {
                    'correlations': full_analysis.get('correlation_matrix', {}),
                    'red_flags': full_analysis.get('data_integrity_issues', []),
                    'nlp_summary': full_analysis.get('text_analysis', {}),
                    'cluster_analysis': full_analysis.get('cluster_results', {})
                },
                
                # Visualization Handling
                'visualizations': {
                    'available': list(visualization_data.keys()),
                    'include_data': False  # Default to not include heavy base64
                }
            }
            
            # Optionally include visualization data if requested
            if request.query_params.get('include_visualizations'):
                results['visualizations']['data'] = visualization_data
                results['visualizations']['include_data'] = True
            
            response['results'] = results
        
        return Response(response)
        
    except Exception as e:
        logger.error(f"Error fetching analysis {analysis_id}: {str(e)}")
        return Response(
            {'error': f"Could not retrieve analysis: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )