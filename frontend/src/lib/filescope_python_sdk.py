"""
FileScope AI Python SDK
A Python wrapper for the FileScope AI dataset analysis API
"""

import requests
import pandas as pd
from typing import Optional, Dict, Any, Union, List
import json
from pathlib import Path
import time


class FileScopePythonSDK:
    """
    Python SDK for FileScope AI dataset analysis
    
    This SDK provides easy access to FileScope AI's dataset analysis capabilities
    from Python applications, Jupyter notebooks, and data science workflows.
    """
    
    def __init__(self, api_key: str, base_url: str = "https://filescopeai-qdpp.onrender.com/api"):
        """
        Initialize the FileScope AI Python SDK
        
        Args:
            api_key (str): Your FileScope AI API key
            base_url (str): Base URL for the API (default: https://filescopeai-qdpp.onrender.com/api)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "FileScope-Python-SDK/1.0.0"
        }
    
    def analyze_dataset(self, file_path: Union[str, Path], **options) -> Dict[str, Any]:
        """
        Analyze a dataset file using FileScope AI
        
        Args:
            file_path (str or Path): Path to the file to analyze
            **options: Additional analysis options:
                - is_public (bool): Whether to make the dataset public
                - analysis_type (str): Type of analysis ('basic', 'comprehensive', 'custom')
                - include_insights (bool): Whether to include detailed insights
                - custom_metrics (list): List of custom metrics to analyze
        
        Returns:
            Dict[str, Any]: Analysis results including quality score, anomalies, and insights
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            requests.RequestException: If the API request fails
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Prepare the request
        url = f"{self.base_url}/analyze"
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'application/octet-stream')}
            
            # Add options to form data
            data = {}
            for key, value in options.items():
                if value is not None:
                    if isinstance(value, (list, dict)):
                        data[key] = json.dumps(value)
                    else:
                        data[key] = str(value)
            
            response = requests.post(
                url,
                headers=self.headers,
                files=files,
                data=data
            )
        
        if not response.ok:
            try:
                error_data = response.json()
                error_msg = error_data.get('message', f'HTTP {response.status_code}')
            except:
                error_msg = f'HTTP {response.status_code}: {response.text}'
            raise requests.RequestException(error_msg)
        
        return response.json()
    
    def get_results(self, analysis_id: str) -> Dict[str, Any]:
        """
        Get analysis results by ID
        
        Args:
            analysis_id (str): The analysis ID from analyze_dataset
            
        Returns:
            Dict[str, Any]: Analysis results
        """
        url = f"{self.base_url}/results/{analysis_id}"
        response = requests.get(url, headers=self.headers)
        
        if not response.ok:
            raise requests.RequestException(f"Failed to get results: {response.status_code}")
        
        return response.json()
    
    def get_public_datasets(self) -> List[Dict[str, Any]]:
        """
        Get list of public datasets
        
        Returns:
            List[Dict[str, Any]]: List of public datasets
        """
        url = f"{self.base_url}/datasets/public"
        response = requests.get(url, headers=self.headers)
        
        if not response.ok:
            raise requests.RequestException(f"Failed to get datasets: {response.status_code}")
        
        return response.json()
    
    def download_report(self, analysis_id: str, output_path: Optional[str] = None) -> str:
        """
        Download analysis report as PDF
        
        Args:
            analysis_id (str): The analysis ID
            output_path (str, optional): Path to save the report. If None, uses analysis_id.pdf
            
        Returns:
            str: Path to the downloaded report
        """
        url = f"{self.base_url}/reports/{analysis_id}"
        response = requests.get(url, headers=self.headers)
        
        if not response.ok:
            raise requests.RequestException(f"Failed to download report: {response.status_code}")
        
        if output_path is None:
            output_path = f"{analysis_id}.pdf"
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        return output_path
    
    def get_analysis_status(self, analysis_id: str) -> Dict[str, Any]:
        """
        Get the current status of an analysis
        
        Args:
            analysis_id (str): The analysis ID
            
        Returns:
            Dict[str, Any]: Status information including progress
        """
        url = f"{self.base_url}/status/{analysis_id}"
        response = requests.get(url, headers=self.headers)
        
        if not response.ok:
            raise requests.RequestException(f"Failed to get status: {response.status_code}")
        
        return response.json()
    
    def wait_for_completion(self, analysis_id: str, timeout: int = 3600, check_interval: int = 5) -> Dict[str, Any]:
        """
        Wait for an analysis to complete
        
        Args:
            analysis_id (str): The analysis ID
            timeout (int): Maximum time to wait in seconds (default: 1 hour)
            check_interval (int): How often to check status in seconds (default: 5)
            
        Returns:
            Dict[str, Any]: Final analysis results
            
        Raises:
            TimeoutError: If the analysis doesn't complete within timeout
        """
        start_time = time.time()
        
        while True:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Analysis {analysis_id} did not complete within {timeout} seconds")
            
            status = self.get_analysis_status(analysis_id)
            
            if status['status'] == 'completed':
                return self.get_results(analysis_id)
            elif status['status'] == 'failed':
                raise requests.RequestException(f"Analysis {analysis_id} failed")
            
            time.sleep(check_interval)
    
    def analyze_dataframe(self, df: pd.DataFrame, **options) -> Dict[str, Any]:
        """
        Analyze a pandas DataFrame directly
        
        Args:
            df (pd.DataFrame): The DataFrame to analyze
            **options: Analysis options
            
        Returns:
            Dict[str, Any]: Analysis results
        """
        # Save DataFrame to temporary CSV file
        temp_file = "temp_analysis.csv"
        df.to_csv(temp_file, index=False)
        
        try:
            result = self.analyze_dataset(temp_file, **options)
            return result
        finally:
            # Clean up temporary file
            Path(temp_file).unlink(missing_ok=True)
    
    def get_quality_summary(self, analysis_result: Dict[str, Any]) -> pd.DataFrame:
        """
        Convert analysis results to a pandas DataFrame for easy analysis
        
        Args:
            analysis_result (Dict[str, Any]): Results from analyze_dataset
            
        Returns:
            pd.DataFrame: Formatted quality summary
        """
        summary_data = {
            'Metric': [
                'Overall Quality Score',
                'Data Completeness',
                'Data Accuracy', 
                'Data Consistency',
                'Data Validity',
                'Total Anomalies',
                'Critical Anomalies',
                'Warning Anomalies'
            ],
            'Score': [
                analysis_result.get('quality_score', 0),
                analysis_result.get('data_quality', {}).get('completeness', 0),
                analysis_result.get('data_quality', {}).get('accuracy', 0),
                analysis_result.get('data_quality', {}).get('consistency', 0),
                analysis_result.get('data_quality', {}).get('validity', 0),
                analysis_result.get('anomalies', {}).get('total', 0),
                analysis_result.get('anomalies', {}).get('critical', 0),
                analysis_result.get('anomalies', {}).get('warnings', 0)
            ]
        }
        
        return pd.DataFrame(summary_data)
    
    def get_anomalies_dataframe(self, analysis_result: Dict[str, Any]) -> pd.DataFrame:
        """
        Convert anomalies to a pandas DataFrame
        
        Args:
            analysis_result (Dict[str, Any]): Results from analyze_dataset
            
        Returns:
            pd.DataFrame: Anomalies details
        """
        anomalies = analysis_result.get('anomalies', {}).get('details', [])
        
        if not anomalies:
            return pd.DataFrame(columns=['Type', 'Message', 'Severity', 'Row', 'Column'])
        
        return pd.DataFrame(anomalies)
    
    def get_insights_dataframe(self, analysis_result: Dict[str, Any]) -> pd.DataFrame:
        """
        Convert insights to a pandas DataFrame
        
        Args:
            analysis_result (Dict[str, Any]): Results from analyze_dataset
            
        Returns:
            pd.DataFrame: Insights details
        """
        insights = analysis_result.get('insights', [])
        
        if not insights:
            return pd.DataFrame(columns=['Type', 'Message', 'Severity', 'Confidence'])
        
        return pd.DataFrame(insights)


# Convenience functions for quick analysis
def quick_analyze(file_path: str, api_key: str, **options) -> Dict[str, Any]:
    """
    Quick analysis function for simple use cases
    
    Args:
        file_path (str): Path to the file to analyze
        api_key (str): Your FileScope AI API key
        **options: Analysis options
        
    Returns:
        Dict[str, Any]: Analysis results
    """
    sdk = FileScopePythonSDK(api_key)
    return sdk.analyze_dataset(file_path, **options)


def analyze_csv(file_path: str, api_key: str, **options) -> Dict[str, Any]:
    """
    Analyze a CSV file specifically
    
    Args:
        file_path (str): Path to the CSV file
        api_key (str): Your FileScope AI API key
        **options: Analysis options
        
    Returns:
        Dict[str, Any]: Analysis results
    """
    return quick_analyze(file_path, api_key, analysis_type='comprehensive', **options)


# Example usage and documentation
if __name__ == "__main__":
    print("FileScope AI Python SDK")
    print("=" * 30)
    print()
    print("Usage examples:")
    print()
    print("# Initialize SDK")
    print("sdk = FileScopePythonSDK('your-api-key')")
    print()
    print("# Analyze a dataset")
    print("results = sdk.analyze_dataset('data.csv', is_public=True)")
    print()
    print("# Get quality summary")
    print("summary_df = sdk.get_quality_summary(results)")
    print("print(summary_df)")
    print()
    print("# Quick analysis")
    print("results = quick_analyze('data.csv', 'your-api-key')") 