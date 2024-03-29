import os
import ast
import gzip
import time
import json
import atexit
import logging
import requests
import subprocess
import urllib.parse
from os.path import join

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request, jsonify
from kafka_message_producer import KafkaMessageProducer
from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials, firestore

from models.company import Company
from exceptions import FirebaseException
from site_summarizer import SiteSummarizer

########### General Config ########### 
logging.basicConfig()
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

openai_api_key = os.getenv('OPENAI_API_KEY')
summarizer = SiteSummarizer(openai_api_key)

# Init Firebase
service_account_key = json.loads(os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY'))
with open('gcp_service_account.json', 'w') as f:
    if 'isThisFileInPlaceholderState' in service_account_key and service_account_key['isThisFileInPlaceholderState']:
        raise_firebase_credentials_committed_exception()
    json.dump(service_account_key, f)
cred = credentials.Certificate('gcp_service_account.json')
app  = firebase_admin.initialize_app(cred)

########### Scheduled Tasks ########### 

def ingestions():
    """
    Reads domain names from gzip files in the 'data/daily' directory.

    Returns:
        list: A list of domain names extracted from the gzip files.
    """
    daily_folder_path = join('data', 'daily')
    app.logger.info(daily_folder_path)

    domains = []
    for file in os.listdir(daily_folder_path):
        app.logger.info(file)
        if file.endswith('.gz'):
            gzip_file_path = os.path.join(daily_folder_path, file)

            with gzip.open(gzip_file_path, 'rt') as f:  # Open in text mode ('rt') for easier processing
                for line in f:
                    app.logger.info(line.strip())
                    domains.append(line.strip())
    return domains

def get_company_enrichment(domain):
    """
    Retrieves company data from the Abstract API using the provided domain.

    Args:
        domain (str): The domain name for which to retrieve company data.

    Returns:
        bytes: The response content from the API if the request is successful.
        tuple: A JSON error message and a status code of 500 if an exception occurs.
    """
    default_scrape_url = "https://companyenrichment.abstractapi.com/v1"
    url = os.getenv('ABSTRACT_API_COMPANY_ENRICHMENT_API_URL', default_scrape_url)
    api_key = os.getenv('ABSTRACT_API_COMPANY_ENRICHMENT_API_KEY', "")

    try:
        response = requests.get(f"{url}/?api_key={api_key}&domain={domain}")
        response.raise_for_status()
        
        response_data = response.json()
        app.logger.info(f'kafka: sync started for {response_data["domain"]}')

        producer = KafkaMessageProducer()
        producer.produce_message('company-data', response_data)
        
        return response_data
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

def ingest_daily_company_data():
    """
    Orchestrates the daily ingestion of company data.

    Retrieves domain names from gzip files using the `ingestions` function,
    fetches company data for each domain using the `company_enrichment` function,
    and inserts the data into the DB`.
    """
    for domain in ingestions():
        company_data = get_company_enrichment(domain) 
        company = Company(data=company_data)
        company.save()

########### Scheduler ########### 

scheduler = BackgroundScheduler()
scheduler.add_job(func=ingest_daily_company_data, trigger="interval", hours=12)
scheduler.start()

########### App Config ########### 

app = Flask(__name__)

########### Endpoints ########### 

@app.route("/api/v1/heartbeat", methods=['GET'])
def heartbeat():    
    return "<p>OK</p>"

@app.route("/api/v1/company-enrichment", methods=['GET'])
def company_enrichment():
    domain = ""

    if request.is_json:
        data = request.json
        domain = data.get('domain')
    else:
        domain = request.form.get('domain')

    # return get_company_enrichment(domain)
    app.logger.info('here')
    company_data = get_company_enrichment(domain) 
    company = Company(data=company_data)
    company.save()
    return company_data

@app.route("/api/v1/scrape", methods=['GET', 'POST'])
def scrape():
    default_scrape_url = "https://scrape.abstractapi.com/v1"
    api_url = os.getenv('ABSTRACT_API_SCRAPE_URL', default_scrape_url)
    api_key = os.getenv('ABSTRACT_API_SCRAPE_API_KEY', "")
    target_url = ""

    if request.is_json:
        data = request.json
        target_url = data.get('url')
        render_js = data.get('render_js', 'true')
        block_ads = data.get('block_ads', 'true')
    else:
        target_url = request.form.get('url')
        render_js = request.form.get('render_js', 'true')
        block_ads = request.form.get('block_ads', 'true')

    try:
        abstractapi = f"{api_url}/?url={target_url}&api_key={api_key}"
        app.logger.info(abstractapi)
        response = requests.get(abstractapi)
        app.logger.info(response)
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/crawl', methods=['POST'])
def crawl():
    try:
        data = request.get_json()
        url = data.get('url')

        if url:
            summary = summarizer.scrape_and_summarize(url)
            return jsonify(summary)
        else:
            return jsonify({"error": "URL not provided"}), 400
    except Exception as e:
        app.logger.exception("An error occurred during summarization")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/_system/daily_merge', methods=['GET', 'POST'])
def daily_system_merge():
    ingest_daily_company_data()

# daily new registered domains (NRDs)
# returns an array of strings
@app.route('/api/v1/_system/ingestions', methods=['GET'])
def ingestions():
    daily_folder_path = join('data', 'daily')
    app.logger.info(daily_folder_path)

    domains = []
    for file in os.listdir(daily_folder_path):
        app.logger.info(file)
        if file.endswith('.gz'):
            gzip_file_path = os.path.join(daily_folder_path, file)

            with gzip.open(gzip_file_path, 'rt') as f:  # Open in text mode ('rt') for easier processing
                for line in f:
                    app.logger.info(line.strip())
                    domains.append(line.strip())
    return domains

@app.route('/api/v1/companies/<id>', methods=['GET'])
def get_company(id):
    db = AstraDBClient()
    return db.find(id)

@app.route('/api/v1/companies_by_name/<name>', methods=['GET'])
def get_company_by_name(name):
    db = AstraDBClient()
    return db.find_by_name(name)

@app.route('/api/v1/companies', methods=['POST'])
def insert_company():
    db = AstraDBClient()
    if request.is_json:
        data = request.json
        company = data.get('company')
    else:
        company = request.form.get('company')

    return db.insert_company(company)

@app.route('/api/v1/subscribe', methods=['POST'])
def add_notion_subscriber():
    notion_token = os.getenv('NOTION_TOKEN', '')
    notion_db_id = os.getenv('NOTION_DB_ID', '')
    notion_version = '2022-06-28'
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {notion_token}',
        'Notion-Version': notion_version,
    }
    print('token')
    print(notion_token)
    print('\ndbid')
    print(notion_db_id)

    # Since Flask does not support await, we will not use async here and will use requests synchronously
    try:
        # First request to get an access token, assuming this endpoint exists and works as intended
        auth_response = requests.get('https://api.notion.com/v1/oauth/databases', headers=headers, json={'grant_type': 'authorization_code'})
        auth_response.raise_for_status()  # This will raise an exception for HTTP errors
        token_data = auth_response.json()
        access_token = token_data.get('access_token')
        print('**********************')
        print(auth_response)
        print('**********************')

        # Update Authorization header with the new access token
        headers['Authorization'] = f'Bearer {access_token}'

        # Second request to create a page in Notion
        page_creation_payload = {
            'parent': {'database_id': notion_db_id},
            'properties': {
                'Email': {
                    'title': [
                        {
                            'text': {
                                'content': request.json.get('email', 'isaacbell388@gmail.com'),
                            },
                        },
                    ],
                },
            },
        }
        page_response = requests.post('https://api.notion.com/v1/pages', headers=headers, json=page_creation_payload)
        page_response.raise_for_status() 

        return jsonify(page_response.json()), 200
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

########### Teardown ########### 

# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())
