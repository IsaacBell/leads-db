# LeadsDB

(**note - **this codebase for the initial prototype app is now archived)

![image](https://github.com/IsaacBell/leads-db/assets/2613157/5b5b3cf3-010f-40e1-a6a5-e1b03bdb6923)


---
## Introduction
LeadsDB is a lead generation system. On the back end, the system performs daily ingestions of company data as well as Newly Registered Domains (NRDs). It attempts to identify companies which may serve as candidate leads, then presents the best results to the user (see below). 

1. ✓ Lead data can be retrieved through a REST API. 
2. 🚧 Users receive email blasts of a few companies each week which match their preferences. (Under construction: Approx. 85% completed)
3. 🔴 Users can integrate LeadsDB into their Hubspot or Salesforce projects, and leads will populate directly in their existing system. (Not started)

This repository is home to the user-facing front end, as well as the user-facing REST API. All code related to data ingestion exists in a separate, [private micro-client](https://github.com/IsaacBell/nrd-poll). 

This repository integrates a Next.js frontend with a Flask backend. For data storage, an [external Cassandra database](https://astra.datastax.com/) is used which then forwards data to external data warehouses through CDC trigger procedures. It includes features such as automatic NRD ingestion, [company data enrichment](https://blog.hubspot.com/sales/data-enrichment) using [Abstract API](https://docs.abstractapi.com/company-enrichment), and subscriber management using the [Notion API](https://github.com/btahir/notion-capture).

The app is automatically deployed to [GCP](https://cloud.google.com/) Cloud Run, where it lives as a stateless app. Importantly, that means that contributors should not add code which saves state locally. We are loosely following a trunk-based branching strategy which will be formalized once Phase 2 is complete.

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
python -m spacy download en_core_web_md
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
  - `OPENAI_API_KEY`: OpenAI API Key
  - `KAFKA_URL`: Kafka broker address
  - `KAFKA_USERNAME`: Kafka username
  - `KAFKA_PASSWORD`: Kafka password
  - `MOESIF_APP_ID`: Moesif API monetization platform

### Start the development servers:

```
pnpm run dev
```

This will concurrently start the Next.js frontend and the Flask backend.

## Frontend

The frontend is built using Next.js and React. It provides a user interface for entering email, country, and industry preferences to subscribe for weekly updates.

### Key files:

- `app/page.tsx`: The main page.
- `utils/staticData.ts`: Contains static data for countries and industries.

## Backend

The backend is built with Flask and provides various API endpoints for company data management and subscriber management.

### Key files:

- `api/index.py`: The main Flask application file that defines the API routes and schedules background tasks.
- `api/models`: All model classes.

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

## Todos

- Use GCloud Build secret keys for the service account credential file
- Finish building API governance system using Moesif
- Set MOESIF_APP_ID in GCP
- Migrate Cloud Build Python version to 3.12.1

## License

This project is licensed under the MIT License.
