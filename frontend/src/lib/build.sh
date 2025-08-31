#!/bin/bash

echo "🚀 Building FileScope AI SDK..."

# Create dist directory
mkdir -p dist

# Build TypeScript
echo "📦 Building TypeScript..."
npx tsc --project tsconfig.json

# Build with Rollup
echo "🔄 Building with Rollup..."
npx rollup -c

# Copy Python SDK
echo "🐍 Copying Python SDK..."
cp filescope_python_sdk.py dist/
cp setup.py dist/
cp requirements.txt dist/
cp README.md dist/
cp package.json dist/

# Create __init__.py for Python package
echo "📁 Creating Python package structure..."
mkdir -p dist/filescope_ai_sdk
echo "from .filescope_python_sdk import FileScopePythonSDK, quick_analyze, analyze_csv" > dist/filescope_ai_sdk/__init__.py
cp filescope_python_sdk.py dist/filescope_ai_sdk/

echo "✅ Build complete! SDK files are in the dist/ directory"
echo ""
echo "📦 To publish to npm:"
echo "   cd dist && npm publish"
echo ""
echo "🐍 To publish to PyPI:"
echo "   cd dist && python setup.py sdist bdist_wheel && twine upload dist/*" 