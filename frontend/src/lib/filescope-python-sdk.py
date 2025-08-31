"""
FileScope AI Python SDK
A simple, powerful Python SDK for integrating AI dataset analysis into your applications
"""

import requests
import json
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


@dataclass
class AnalysisResult:
    """Analysis result data structure"""
    analysis_id: str
    quality_score: float
    anomalies: Dict[str, int]
    completeness: Optional[float] = None
    consistency: Optional[float] = None
    accuracy: Optional[float] = None
    validity: Optional[float] = None
    bias_metrics: Optional[Dict[str, Any]] = None
    insights: Optional[List[Dict[str, str]]] = None


@dataclass
class Dataset:
    """Dataset information structure"""
    id: str
    title: str
    description: str
    quality_score: float
    anomalies_total: int
    file_size: str
    upload_date: str


class FileScopePythonSDK:
    """
    Main FileScope AI SDK class for Python
    Use this to integrate FileScope AI analysis into your Python applications
    """
    
    def __init__(self, api_key: str, base_url: str = "https://your-api.com"):
        """
        Initialize the SDK
        
        Args:
            api_key (str): Your FileScope AI API key
            base_url (str): Base URL for the API (optional)
        """
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def analyze_dataset(self, file_path: str, is_public: bool = False, analysis_type: str = "comprehensive") -> AnalysisResult:
        """
        Analyze a dataset file using FileScope AI
        
        Args:
            file_path (str): Path to the file to analyze
            is_public (bool): Whether to make the dataset public
            analysis_type (str): Type of analysis ('basic' or 'comprehensive')
            
        Returns:
            AnalysisResult: Analysis results
            
        Raises:
            Exception: If analysis fails
        """
        try:
            with open(file_path, 'rb') as file:
                files = {'file': file}
                data = {
                    'isPublic': is_public,
                    'analysisType': analysis_type
                }
                
                response = requests.post(
                    f"{self.base_url}/analyze",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    data=data
                )
                
                if not response.ok:
                    raise Exception(f"Analysis failed: {response.status_text}")
                
                result_data = response.json()
                return self._parse_analysis_result(result_data)
                
        except FileNotFoundError:
            raise Exception(f"File not found: {file_path}")
        except Exception as e:
            raise Exception(f"Analysis failed: {str(e)}")
    
    def get_results(self, analysis_id: str) -> AnalysisResult:
        """
        Get analysis results by ID
        
        Args:
            analysis_id (str): The analysis ID from analyze_dataset
            
        Returns:
            AnalysisResult: Analysis results
            
        Raises:
            Exception: If failed to get results
        """
        try:
            response = requests.get(
                f"{self.base_url}/results/{analysis_id}",
                headers=self.headers
            )
            
            if not response.ok:
                raise Exception(f"Failed to get results: {response.status_text}")
            
            result_data = response.json()
            return self._parse_analysis_result(result_data)
            
        except Exception as e:
            raise Exception(f"Failed to get results: {str(e)}")
    
    def get_public_datasets(self) -> List[Dataset]:
        """
        Get list of public datasets from FileScope AI
        
        Returns:
            List[Dataset]: List of public datasets
            
        Raises:
            Exception: If failed to get datasets
        """
        try:
            response = requests.get(
                f"{self.base_url}/datasets/public",
                headers=self.headers
            )
            
            if not response.ok:
                raise Exception(f"Failed to get datasets: {response.status_text}")
            
            datasets_data = response.json()
            return [self._parse_dataset(dataset_data) for dataset_data in datasets_data]
            
        except Exception as e:
            raise Exception(f"Failed to get datasets: {str(e)}")
    
    def download_report(self, analysis_id: str, output_path: str = None) -> str:
        """
        Download analysis report as PDF
        
        Args:
            analysis_id (str): The analysis ID
            output_path (str): Path to save the PDF (optional)
            
        Returns:
            str: Path to the downloaded PDF
            
        Raises:
            Exception: If failed to download report
        """
        try:
            response = requests.get(
                f"{self.base_url}/reports/{analysis_id}/pdf",
                headers=self.headers
            )
            
            if not response.ok:
                raise Exception(f"Failed to download report: {response.status_text}")
            
            if output_path is None:
                output_path = f"analysis_report_{analysis_id}.pdf"
            
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            return output_path
            
        except Exception as e:
            raise Exception(f"Failed to download report: {str(e)}")
    
    def _parse_analysis_result(self, data: Dict[str, Any]) -> AnalysisResult:
        """Parse API response into AnalysisResult object"""
        return AnalysisResult(
            analysis_id=data.get('analysis_id', ''),
            quality_score=data.get('quality_score', 0.0),
            anomalies=data.get('anomalies', {}),
            completeness=data.get('completeness'),
            consistency=data.get('consistency'),
            accuracy=data.get('accuracy'),
            validity=data.get('validity'),
            bias_metrics=data.get('bias_metrics'),
            insights=data.get('insights')
        )
    
    def _parse_dataset(self, data: Dict[str, Any]) -> Dataset:
        """Parse API response into Dataset object"""
        return Dataset(
            id=data.get('id', ''),
            title=data.get('title', ''),
            description=data.get('description', ''),
            quality_score=data.get('quality_score', 0.0),
            anomalies_total=data.get('anomalies_total', 0),
            file_size=data.get('file_size', ''),
            upload_date=data.get('upload_date', '')
        )


# Example usage
if __name__ == "__main__":
    # Initialize the SDK
    sdk = FileScopePythonSDK("your-api-key")
    
    try:
        # Analyze a dataset
        results = sdk.analyze_dataset("your_dataset.csv", is_public=True)
        print(f"Analysis complete! Quality score: {results.quality_score}%")
        print(f"Anomalies found: {results.anomalies.get('total', 0)}")
        
        # Get public datasets
        datasets = sdk.get_public_datasets()
        print(f"Found {len(datasets)} public datasets")
        
        # Download report
        report_path = sdk.download_report(results.analysis_id)
        print(f"Report downloaded to: {report_path}")
        
    except Exception as e:
        print(f"Error: {e}") 