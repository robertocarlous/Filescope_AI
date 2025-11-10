# FileScope AI – Backend (Django)  

This backend ingests datasets, performs AI-driven analysis, generates branded PDF reports, and now bridges the results into **Filecoin Onchain Cloud (FOC)** for verifiable storage and programmable settlement.

---

## High-Level Flow

1. **Upload & Analysis**  
   - `POST /api/upload/` accepts datasets (CSV/JSON/Excel/Parquet/Word).  
   - `core_ai.tasks.process_dataset` loads the file, runs quality/anomaly/bias checks, produces structured metrics, and renders a FileScope-branded PDF (`core_ai.reporting.generate_pdf_report`).

2. **Frontend Registration**  
   - The frontend takes the returned metadata/CIDs and registers the dataset on-chain via `FileScopeRegistry.uploadDataset()`.  
   - Purchases still call the existing smart contract; checkout UI now wraps the call and can be extended to trigger Filecoin Pay flows.

---

## Supported Upload Formats

The pipeline can ingest the following file types:

- CSV (`.csv`)
- JSON (`.json`)
- Excel (`.xlsx`, `.xls`)
- Parquet (`.parquet`)
- Microsoft Word (`.docx`, `.doc`) – converted to a single `text` column using Mammoth.

Invalid or unsupported files are rejected before analysis begins.

---

## Project Structure

```
backend/
 ├─ core_ai/
 │   ├─ models.py                # DatasetAnalysis model + stored metrics
 │   ├─ tasks.py                 # AI pipeline + DOC/DOCX ingestion + PDF hook
 │   ├─ reporting.py             # Branded PDF generation
 │   ├─ views.py                 # REST endpoints (upload/status/etc.)
 │   └─ migrations/              # Django schema migrations
 └─ requirements.txt             # ReportLab + analytics stack
```

---

## Key Components

### `core_ai.reporting.generate_pdf_report`

Generates branded, human-readable summaries with ReportLab. Output is stored in `media/reports/analysis_<id>.pdf`.

### `core_ai.tasks.process_dataset`

1. Loads dataset and computes:
   - `basic_stats`, `quality_analysis`, `anomaly_detection`, `bias_analysis`, `insights`, `visualizations`
2. Creates PDF report.
3. Persists metrics on `DatasetAnalysis`.  
4. Returns analysis results (including PDF metadata) to the caller.

---

## Running Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py runserver
```

Use the existing `POST /api/upload/` endpoint to trigger the analysis pipeline. Check `GET /api/analysis/<id>/status/` to inspect stored metrics and retrieve the branded PDF location.

---

## Deployment Notes

- **Dependencies**: `reportlab` and `requests` must be available (already listed in `requirements.txt`).  
- **Media persistence**: ensure the `media/reports/` directory is writable; configure S3 or equivalent if running on multiple instances.  
- **Error handling**: analysis failures set the `DatasetAnalysis.status` to `failed` and record the exception in logs.

---

## Extending Further

- Wire the checkout flow to additional storage layers (e.g., Synapse SDK) if desired—handled outside of this Django service.  
- Add scheduled jobs to refresh cached metrics or regenerate reports using Celery or Django management commands.

