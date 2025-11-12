import matplotlib

matplotlib.use('Agg')
import base64
import io
import json
import logging
import os
from typing import Any, Dict, List

import mammoth
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from .models import DatasetAnalysis
from .reporting import generate_pdf_report

logger = logging.getLogger(__name__)
plt.style.use('seaborn-v0_8')
sns.set_theme(style="whitegrid")
plt.rcParams['figure.figsize'] = (10, 6)
plt.rcParams['axes.labelsize'] = 12

ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.xls', '.parquet', '.doc', '.docx'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

def load_dataset(file_path):
    """Load dataset from file path"""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            return pd.read_csv(file_path)
        elif ext == '.json':
            return pd.read_json(file_path)
        elif ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif ext == '.parquet':
            return pd.read_parquet(file_path)
        elif ext in ['.doc', '.docx']:
            return load_word_document(file_path)
        return pd.read_csv(file_path)  # Try CSV as default
    except Exception as e:
        logger.error(f"Error loading dataset: {str(e)}")
        return None


def load_word_document(file_path: str) -> pd.DataFrame:
    """Convert DOC/DOCX files into a simple text dataframe."""
    try:
        with open(file_path, "rb") as doc_file:
            result = mammoth.extract_raw_text(doc_file)
        raw_text = (result.value or "").strip()
    except Exception as exc:
        logger.error("Failed to extract text from Word document %s: %s", file_path, exc)
        raise

    if not raw_text:
        return pd.DataFrame({'text': []})

    rows = [
        line.strip()
        for line in raw_text.splitlines()
        if line.strip()
    ]
    if not rows:
        rows = [raw_text]

    return pd.DataFrame({'text': rows})

def get_basic_statistics(df):
    """Generate basic dataset statistics"""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    
    stats = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'numeric_columns': len(numeric_cols),
        'categorical_columns': len(categorical_cols),
        'missing_values': df.isnull().sum().sum(),
        'duplicate_rows': df.duplicated().sum(),
        'column_info': {}
    }
    
    for col in df.columns:
        col_info = {
            'type': str(df[col].dtype),
            'null_count': df[col].isnull().sum(),
            'unique_values': df[col].nunique(),
        }
        if col in numeric_cols:
            col_info.update({
                'mean': df[col].mean(),
                'std': df[col].std(),
                'min': df[col].min(),
                'max': df[col].max()
            })
        elif col in categorical_cols:
            col_info.update({
                'most_common': df[col].mode()[0] if not df[col].empty else None,
                'value_counts': df[col].value_counts().head(5).to_dict()
            })
        stats['column_info'][col] = col_info
    
    return stats

def analyze_data_quality(df):
    """Analyze dataset quality metrics"""
    quality_issues = []
    scores = {'missing_data_score': 100, 'duplicate_score': 100, 'consistency_score': 100}
    
    # Missing data analysis
    missing_pct = (df.isnull().sum() / len(df)) * 100
    scores['missing_data_score'] = max(0, 100 - missing_pct.mean())
    if missing_pct.mean() > 20:
        quality_issues.append(f"High missing data: {missing_pct.mean():.1f}%")
    
    # Duplicate analysis
    duplicate_pct = (df.duplicated().sum() / len(df)) * 100
    scores['duplicate_score'] = max(0, 100 - duplicate_pct)
    if duplicate_pct > 5:
        quality_issues.append(f"High duplicate rate: {duplicate_pct:.1f}%")
    
    # Data consistency
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if not df[col].isnull().all():
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = ((df[col] < (Q1 - 3*IQR)) | (df[col] > (Q3 + 3*IQR))).sum()
            if outliers > 0:
                scores['consistency_score'] -= 10
    
    return {
        'overall_score': round((scores['missing_data_score'] + scores['duplicate_score'] + scores['consistency_score']) / 3, 2),
        'component_scores': scores,
        'quality_issues': quality_issues
    }

# def detect_anomalies(df):
#     """Detect anomalies in numeric columns"""
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     if len(numeric_cols) == 0:
#         return {'total_anomalies': 0, 'anomaly_details': {}}
    
#     # Isolation Forest
#     clf = IsolationForest(contamination=0.1, random_state=42)
#     anomalies = clf.fit_predict(df[numeric_cols])
#     anomaly_indices = np.where(anomalies == -1)[0]
    
#     return {
#         'total_anomalies': len(anomaly_indices),
#         'anomaly_details': {
#             'isolation_forest': {
#                 'count': len(anomaly_indices),
#                 'indices': anomaly_indices.tolist()[:50]  # Limit to first 50
#             }
#         }
#     }

# def detect_anomalies(df):
#     """Enhanced anomaly detection with severity classification"""
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     if len(numeric_cols) == 0:
#         return {
#             'total_anomalies': 0,
#             'critical': 0,
#             'moderate': 0,
#             'examples': []
#         }
    
#     # Isolation Forest
#     clf = IsolationForest(contamination=0.1, random_state=42)
#     anomalies = clf.fit_predict(df[numeric_cols])
#     anomaly_indices = np.where(anomalies == -1)[0]
    
#     # Calculate severity (example logic)
#     critical = []
#     moderate = []
#     for idx in anomaly_indices:
#         row = df.iloc[idx][numeric_cols]
#         severity = "critical" if (row - df[numeric_cols].mean()).abs().max() > 3*df[numeric_cols].std().max() else "moderate"
#         if severity == "critical":
#             critical.append(idx)
#         else:
#             moderate.append(idx)
    
#     return {
#         'total_anomalies': len(anomaly_indices),
#         'critical': len(critical),
#         'moderate': len(moderate),
#         'examples': {
#             'critical': critical[:3], 
#             'moderate': moderate[:3]
#         }
#     }
# core_ai/tasks.py
import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# 1. ANALYSIS FUNCTIONS (stubs – replace with real logic later)
# ------------------------------------------------------------------

def detect_anomalies(df: pd.DataFrame) -> dict:
    """Simple Isolation Forest placeholder"""
    try:
        from sklearn.ensemble import IsolationForest
        numeric = df.select_dtypes(include=[np.number]).fillna(0)
        if numeric.empty or len(numeric) < 10:
            return {
                'total_anomalies': 0,
                'critical': 0,
                'moderate': 0,
                'examples': []
            }
        iso = IsolationForest(contamination=0.1, random_state=42)
        preds = iso.fit_predict(numeric)
        anomalies = numeric[preds == -1]
        total = len(anomalies)
        critical = int(total * 0.4)
        moderate = total - critical
        return {
            'total_anomalies': total,
            'critical': critical,
            'moderate': moderate,
            'examples': anomalies.head(3).to_dict(orient='records')
        }
    except Exception as e:
        logger.warning(f"Anomaly detection failed: {e}")
        return {'total_anomalies': 0, 'critical': 0, 'moderate': 0, 'examples': []}


def analyze_bias(df: pd.DataFrame) -> dict:
    """Detect columns with >80% same value"""
    imbalanced = {}
    for col in df.columns:
        try:
            vc = df[col].value_counts(normalize=True)
            if len(vc) > 0 and vc.iloc[0] > 0.8:
                imbalanced[col] = {
                    'dominant_value': str(vc.index[0]),
                    'pct': round(vc.iloc[0] * 100, 1)
                }
        except:
            continue
    score = max(100 - len(imbalanced) * 10, 0)
    return {
        'overall_bias_score': score,
        'bias_issues': list(imbalanced.keys()),
        'imbalanced_fields': imbalanced
    }


# ------------------------------------------------------------------
# 2. HELPER / METRIC FUNCTIONS
# ------------------------------------------------------------------

def calculate_base_quality_score(df: pd.DataFrame) -> float:
    return 95.0

def calculate_completeness_score(df: pd.DataFrame) -> float:
    return round((1 - df.isna().mean().mean()) * 100, 2)

def calculate_consistency_score(df: pd.DataFrame) -> float:
    return 98.0

def get_smart_basic_metrics(df: pd.DataFrame, dataset_info: dict) -> dict:
    return {
        'rows': int(dataset_info.get('rows', df.shape[0])),
        'columns': int(dataset_info.get('columns', df.shape[1])),
        'missing_pct': round(df.isna().mean().mean() * 100, 2),
        'duplicate_pct': round((df.duplicated().sum() / len(df)) * 100, 2) if len(df) > 0 else 0
    }

def generate_smart_insights(df: pd.DataFrame, dataset_info: dict, file_issues: list) -> list:
    insights = []
    if df.isna().any().any():
        insights.append("Missing values detected in one or more columns.")
    if df.duplicated().any():
        insights.append("Duplicate rows found in the dataset.")
    if file_issues:
        insights.append("File format issues detected – review file health.")
    return insights


# ------------------------------------------------------------------
# 3. VISUALIZATION & ADVANCED (stubs)
# ------------------------------------------------------------------

def generate_visualizations_smart(df: pd.DataFrame, file_issues: list) -> dict:
    """
    Placeholder – returns empty dict.
    Replace with real Plotly/Matplotlib → base64 later.
    """
    return {}


def get_detailed_statistics(df: pd.DataFrame) -> dict:
    return {}

def analyze_content_type(df: pd.DataFrame, dataset_info: dict) -> dict:
    return {}

def generate_recommendations(df: pd.DataFrame, dataset_info: dict, file_issues: list) -> list:
    return []

# def create_visualizations(df):
#     """Generate visualization data"""
#     visualizations = {}
    
#     # Missing data heatmap
#     if df.isnull().sum().sum() > 0:
#         fig, ax = plt.subplots()
#         sns.heatmap(df.isnull(), cbar=False, ax=ax)
#         visualizations['missing_data'] = plot_to_base64(fig)
#         plt.close(fig)
    
#     # Numeric distributions (first 3 columns)
#     numeric_cols = df.select_dtypes(include=[np.number]).columns[:3]
#     for col in numeric_cols:
#         fig, ax = plt.subplots()
#         df[col].hist(ax=ax)
#         visualizations[f'distribution_{col}'] = plot_to_base64(fig)
#         plt.close(fig)
    
#     return visualizations

def create_visualizations(df):
    """Generate visualization data using non-interactive backend"""
    visualizations = {}
    
    # Missing data heatmap
    if df.isnull().sum().sum() > 0:
        fig, ax = plt.subplots()
        sns.heatmap(df.isnull(), cbar=False, ax=ax)
        visualizations['missing_data'] = plot_to_base64(fig)
        plt.close(fig)  # Important: close the figure to free memory
    
    # Numeric distributions (first 3 columns)
    numeric_cols = df.select_dtypes(include=[np.number]).columns[:3]
    for col in numeric_cols:
        fig, ax = plt.subplots()
        df[col].hist(ax=ax)
        visualizations[f'distribution_{col}'] = plot_to_base64(fig)
        plt.close(fig)  # Important: close the figure
    
    return visualizations

def plot_to_base64(fig):
    """Convert matplotlib figure to base64 without GUI"""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    buf.close()
    return img_base64

    
def process_dataset(analysis_id: int):
    """
    Main function to process uploaded dataset with AI analysis (synchronous version)
    """
    try:
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        analysis.status = 'processing'
        analysis.save()
        
        # Load and validate dataset
        file_path = analysis.dataset_file.path
        df = load_dataset(file_path)
        
        if df is None:
            raise Exception("Could not load dataset")
        
        # Perform comprehensive analysis
        results = {
            'basic_stats': get_basic_statistics(df),
            'quality_analysis': analyze_data_quality(df),
            'anomaly_detection': detect_anomalies(df),
            'bias_analysis': analyze_bias(df),
            'insights': generate_insights(df),
            'visualizations': create_visualizations(df)
        }
        
        # Generate branded PDF report
        pdf_metadata = {
            "headline": {
                "dataset_name": os.path.basename(analysis.dataset_file.name),
                "dimensions": f"{df.shape[0]} x {df.shape[1]}",
                "uploaded_at": analysis.uploaded_at.isoformat(),
                "quality_score": results['quality_analysis']['overall_score'],
            },
            "quality": {
                "completeness": results['quality_analysis']['component_scores']['missing_data_score'],
                "duplicates": results['quality_analysis']['component_scores']['duplicate_score'],
                "schema": results['quality_analysis']['component_scores']['consistency_score'],
            },
            "anomalies": {
                "count": results['anomaly_detection']['total_anomalies'],
                "critical": results['anomaly_detection'].get('critical', 0),
                "moderate": results['anomaly_detection'].get('moderate', 0),
            },
            "bias": {
                "score": results['bias_analysis']['overall_bias_score'],
                "assessment": "high" if results['bias_analysis']['overall_bias_score'] < 70 else "moderate"
                if results['bias_analysis']['overall_bias_score'] < 85
                else "low",
                "fields": results['bias_analysis'].get('bias_issues', []),
            },
            "insights": (
                [results['insights']['summary']]
                + results['insights'].get('key_findings', [])
                + results['insights'].get('recommendations', [])
            ),
        }

        pdf_report_path = None
        try:
            pdf_report_path = generate_pdf_report(
                analysis_id=analysis.id,
                metadata=pdf_metadata,
            )
            logger.info("Generated PDF report for analysis %s at %s", analysis.id, pdf_report_path)
        except Exception as pdf_error:  # pragma: no cover - best effort
            logger.warning("Failed to generate PDF report for analysis %s: %s", analysis.id, pdf_error)

        # Update analysis record
        analysis.quality_score = results['quality_analysis']['overall_score']
        analysis.anomaly_count = results['anomaly_detection']['total_anomalies']
        analysis.bias_score = results['bias_analysis']['overall_bias_score']
        analysis.dataset_size = f"{df.shape[0]} rows, {df.shape[1]} columns"
        analysis.key_insights = results['insights']
        analysis.visualization_data = results['visualizations']
        analysis.full_analysis = results

        analysis.status = 'completed'
        analysis.save()
        
        return results
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {str(e)}")
        analysis.status = 'failed'
        analysis.save()
        raise

