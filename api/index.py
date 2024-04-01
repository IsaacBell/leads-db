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
import threading
from os.path import join

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request, jsonify, Response
from kafka_message_producer import KafkaMessageProducer
from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials, firestore
from moesifwsgi import MoesifMiddleware, MoesifAPIClient

from models.user import User
from models.company import Company
from exceptions import raise_auth_exception, raise_firebase_credentials_committed_exception
from site_summarizer import SiteSummarizer

########### App Config ########### 

app = Flask(__name__)
moesif_app_id = os.getenv('MOESIF_APP_ID')
moesif_client = MoesifAPIClient(moesif_app_id).api

moesif_settings = {
    'DEBUG': True,
    'APPLICATION_ID': moesif_app_id,
    'CAPTURE_OUTGOING_REQUESTS': False, # Set to True to also capture outgoing calls to 3rd parties.
    'LOG_BODY': True,
}

app.wsgi_app = MoesifMiddleware(app.wsgi_app, moesif_settings)


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
firebase_app = firebase_admin.initialize_app(cred)

########### Scheduled Tasks ########### 

def identify_user_session():
    api_token = request.headers.get('X-API-TOKEN')
    user_email = request.headers.get('X-USER-EMAIL')
    if not api_token:
        return None
    update = moesif_client.update_user({
        'user_id': api_token,
        'metadata': user_email,
    })
    app.logger.info(f'Identified user session: {update}')
    return update

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

def get_company_enrichment(domain, kafka_logs_enabled: bool = True):
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

        app.logger.info(f'company data: {response.content}')
        if kafka_logs_enabled and response_data['name']:
            app.logger.info(f'kafka: sync started for {response_data["domain"]}')
            # small hack to make kafka work. CHANGE AT YOUR OWN PERIL
            app.logger.info(f'kafka: sync started for {response_data["domain"]}')
            decoded_json = ast.literal_eval(response.content.decode("utf-8"))
            app.logger.info(f'kafka: decoded json: {decoded_json}')        

            producer = KafkaMessageProducer()
            producer.produce_message('company-data', decoded_json)
        
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
    with app.app_context():
        companies = []
        for domain in ingestions():
            try:
                company_data = get_company_enrichment(domain, kafka_logs_enabled=False)
                if company_data:
                    company = Company(data=company_data)
                    company.save()
                    companies.append(company.data)
            except Exception as e:
                # Log the error and continue with the next domain
                app.logger.exception(f"Error processing {domain}: {e}")
                continue
        return companies

########### Scheduler ########### 

scheduler = BackgroundScheduler()
scheduler.add_job(func=ingest_daily_company_data, trigger="interval", hours=12)
scheduler.start()

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

@app.route('/api/v1/_system/sync', methods=['GET', 'POST'])
def system_sync():
    threading.Thread(target=ingest_daily_company_data).start()
    return Response('Enqueued', status=200)

@app.route('/api/v1/companies/<id>', methods=['GET'])
def get_company(id):
    if not identify_user_session():
        return jsonify({
            'status': 'error',
            'message': 'Unable to authorize user. Please review your credentials.'
        }), 400
    return Company.get_by_id(id)

@app.route('/api/v1/companies_by_name/<name>', methods=['GET'])
def get_company_by_name(name):
    if not identify_user_session():
        return jsonify({
            'status': 'error',
            'message': 'Unable to authorize user. Please review your credentials.'
        }), 400
    return Company.get_by_name(name)

@app.route('/api/v1/companies', methods=['POST'])
def insert_company():
    try:
        data = request.json['data']
        company = Company(data)
        company.save()
        
        return jsonify({
            'status': 'success',
            'message': 'Company created successfully',
            'data': {
                'id': company.id,
                'data': company.data
            }
        }), 201
    except KeyError:
        return jsonify({
            'status': 'error',
            'message': 'Missing required field: data'
        }), 400
    except Exception as e:
        current_app.logger.error(f'Error inserting company: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': 'An error occurred while inserting the company'
        }), 500

@app.route('/api/v1/users/<id>', methods=['GET'])
def get_user(id):
    if not identify_user_session():
        return jsonify({
            'status': 'error',
            'message': 'Unable to authorize user. Please review your credentials.'
        }), 400
    return User.get_by_id(id)

@app.route('/api/v1/users_by_name/<name>', methods=['GET'])
def get_user_by_name(name):
    if identify_user_session() == None:
        return jsonify({
            'status': 'error',
            'message': 'Unable to authorize user. Please review your credentials.'
        }), 400
    return User.get_by_name(name)

@app.route('/api/v1/subscribe', methods=['POST'])
def subscribe_user():
    try:
        data = request.json['data']
        user = User(data)
        user.save()

        return jsonify({
            'status': 'success',
            'message': 'User created successfully',
            'data': {
                'id': user.id,
                'data': user.data
            }
        }), 201
    except KeyError as e:
        app.logger.error(f'KeyError creating user. Check the "data" field in your JSON. Error: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': 'Missing required field: data'
        }), 400
    except Exception as e:
        app.logger.error(f'Error creating user: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': 'An error occurred during creation'
        }), 500

@app.route('/api/v1/experimental/notion-subscribe')
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
    app.logger.info('token')
    app.logger.info(notion_token)
    app.logger.info('\ndbid')
    app.logger.info(notion_db_id)

    # Since Flask does not support await, we will not use async here and will use requests synchronously
    try:
        # First request to get an access token, assuming this endpoint exists and works as intended
        auth_response = requests.get('https://api.notion.com/v1/oauth/databases', headers=headers, json={'grant_type': 'authorization_code'})
        auth_response.raise_for_status()  # This will raise an exception for HTTP errors
        token_data = auth_response.json()
        access_token = token_data.get('access_token')
        app.logger.info('**********************')
        app.logger.info(auth_response)
        app.logger.info('**********************')

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
        app.logger.error(f'Error subscribing Notion user: {e}')
        return jsonify({'error': str(e)}), 500

########### Teardown ########### 

# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())
