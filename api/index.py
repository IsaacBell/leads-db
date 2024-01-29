import os
import gzip
import requests
import subprocess
import urllib.parse
from os.path import join

from db import AstraDBClient

from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route("/api/heartbeat")
def hello_world():
    return "<p>OK</p>"

@app.route("/api/v1/company-enrichment", methods=['GET', 'POST'])
def company_enrichment():
    default_scrape_url = "https://companyenrichment.abstractapi.com/v1"
    url = os.getenv('ABSTRACT_API_COMPANY_ENRICHMENT_API_URL', default_scrape_url)
    api_key = os.getenv('ABSTRACT_API_COMPANY_ENRICHMENT_API_KEY', "")
    domain = ""

    if request.is_json:
        data = request.json
        domain = data.get('domain')
    else:
        domain = request.form.get('domain')
    app.logger.info(f"{url}/?api_key={api_key}&domain={domain}")

    try:
        response = requests.get(f"{url}/?api_key={api_key}&domain={domain}")
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

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

@app.route('/api/v1/_system/daily_merge', methods=['GET', 'POST'])
def daily_system_merge():
    command = [
        'python', 
        '(internal)/daily_merge.py', 
        '--fresh-dir', 
        "/tmp/zones", 
        '--referential-dir', 
        "data/zones"
    ]
    
    try:
        # Run the script and capture the output
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Return the output and error (if any)
        return jsonify({
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/v1/_system/extract_company_data', methods=['GET'])
def extract_company_data():
    daily_folder_path = join('data', 'daily')
    app.logger.info(daily_folder_path)

    for file in os.listdir(daily_folder_path):
        app.logger.info(file)
        if file.endswith('.gz'):
            gzip_file_path = os.path.join(daily_folder_path, file)

            domains = []
            with gzip.open(gzip_file_path, 'rt') as f:  # Open in text mode ('rt') for easier processing
                for line in f:
                    app.logger.info(line.strip())
                    domains.append(line.strip())

            return domains
    return []

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
    app.logger.info('-------------------------------------')
    app.logger.info('')
    app.logger.info('-------------------------------------')
    db = AstraDBClient()
    if request.is_json:
        data = request.json
        company = data.get('company')
    else:
        company = request.form.get('company')

    return 'yes'
    # return db.insert_company(company)
