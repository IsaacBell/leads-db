# LeadsDB

LeadsDB is a small app which performs daily ingestions of Newly Registered Domains (NRDs), then attempts to identify new or expanding companies which may serve as potential leads for sales teams. The project integrates a Next.js frontend with a Flask backend. It includes features such as company data ingestion, company enrichment using the Abstract API, and subscriber management using Notion API.

## Prerequisites

- Node.js
- Python 3.x
- pip package manager

## Getting Started

### Clone the repository:

```
git clone https://github.com/IsaacBell/leads-db.git
cd leads-db
```

### Install the dependencies:

```
pnpm install
pip install -r requirements.txt
```

### Set up environment variables:

- Create a `.env` file in the root directory.
- Add the following variables to the `.env` file:
  - `ASTRA_DB_API_ENDPOINT`: Astra DB API endpoint URL
  - `ASTRA_DB_APPLICATION_TOKEN`: Astra DB application token
  - `PULSAR_STREAMING_API_TOKEN`: Pulsar streaming API token
  - `ASTRA_DB_STREAMING_URL`: Astra DB streaming URL
  - `ABSTRACT_API_COMPANY_ENRICHMENT_API_URL`: Abstract API company enrichment URL
  - `ABSTRACT_API_COMPANY_ENRICHMENT_API_KEY`: Abstract API company enrichment API key
  - `ABSTRACT_API_SCRAPE_URL`: Abstract API scrape URL
  - `ABSTRACT_API_SCRAPE_API_KEY`: Abstract API scrape API key
  - `NOTION_TOKEN`: Notion API token
  - `NOTION_DB_ID`: Notion database ID

### Start the development servers:

```
pnpm run dev
```

This will concurrently start the Next.js frontend and the Flask backend.

## Frontend

The frontend is built using Next.js and React. It provides a user interface for entering email, country, and industry preferences to subscribe for weekly updates.

### Key files:

- `pages/index.tsx`: The main page component that renders the subscription form.
- `utils/staticData.ts`: Contains static data for countries and industries.

## Backend

The backend is built with Flask and provides various API endpoints for company data management and subscriber management.

### Key files:

- `api/index.py`: The main Flask application file that defines the API routes and schedules background tasks.
- `api/db.py`: Defines the AstraDBClient class for interacting with Astra DB.

## API Endpoints

- `/api/heartbeat`: Returns a heartbeat response to check if the server is running.
- `/api/v1/company-enrichment`: Retrieves company data from the Abstract API using a provided domain.
- `/api/v1/scrape`: Scrapes a web page using the Abstract API.
- `/api/v1/_system/daily_merge`: Performs a daily merge of data.
- `/api/v1/_system/ingestions`: Returns daily new registered domains (NRDs).
- `/api/v1/companies/<id>`: Retrieves a company by its ID.
- `/api/v1/companies_by_name/<name>`: Retrieves a company by its name.
- `/api/v1/companies`: Inserts a new company.
- `/api/v1/subscribe`: Adds a new subscriber using the Notion API.

## GitHub Actions

The repository includes a GitHub Actions workflow for daily data updates. The workflow is defined in `.github/workflows/daily-updater.yml` and runs on a scheduled basis or can be triggered manually.

## License

This project is licensed under the MIT License.
