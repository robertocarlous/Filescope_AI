from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="filescope-ai-sdk",
    version="1.0.0",
    author="FileScope AI",
    author_email="support@filescope.ai",
    description="Official SDK for FileScope AI - AI-powered dataset analysis and quality assessment",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://filescope.ai/sdk",
    project_urls={
        "Bug Reports": "https://github.com/filescope-ai/filescope-ai-sdk/issues",
        "Source": "https://github.com/filescope-ai/filescope-ai-sdk",
        "Documentation": "https://filescope.ai/sdk",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=22.0.0",
            "flake8>=5.0.0",
            "mypy>=1.0.0",
            "pre-commit>=2.20.0",
        ],
        "jupyter": [
            "jupyter>=1.0.0",
            "ipywidgets>=8.0.0",
        ],
    },
    keywords=[
        "ai",
        "data-analysis",
        "data-quality",
        "machine-learning",
        "dataset",
        "analytics",
        "python",
        "pandas",
        "numpy",
    ],
    include_package_data=True,
    zip_safe=False,
) 