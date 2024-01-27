import os
import gzip
import requests
from os.path import join
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route("/api/heartbeat")
def hello_world():
    return "<p>Hello, World!</p>"

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

    querystring = {"url": target_url, "api_key": api_key, "domain": domain}

    try:
        response = requests.get(url, params=querystring)
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/v1/scrape", methods=['GET', 'POST'])
def scrape():
    default_scrape_url = "https://scrape.abstractapi.com/v1"
    url = os.getenv('ABSTRACT_API_SCRAPE_URL', default_scrape_url)
    api_key = os.getenv('ABSTRACT_API_SCRAPE_URL', "")

    if request.is_json:
        data = request.json
        target_url = data.get('url')
        render_js = data.get('render_js', 'true')
        block_ads = data.get('block_ads', 'true')
    else:
        target_url = request.form.get('url')
        render_js = request.form.get('render_js', 'true')
        block_ads = request.form.get('block_ads', 'true')

    querystring = {"url": target_url, "api_key": api_key, "render_js": render_js, "block_ads": block_ads}

    try:
        response = requests.get(url, params=querystring)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/_system/daily_merge', methods=['POST'])
def daily_system_merge():
    # fresh_dir = request.form.get('fresh_dir')
    # referential_dir = request.form.get('referential_dir')

    command = [
        'python', 
        './(internal)/daily_merge.py', 
        '--fresh-dir', 
        "/tmp/zones", 
        '--referential-dir', 
        "../data/zones"
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
    daily_folder_path = 'data/daily'

    for file in os.listdir(daily_folder_path):
        if file.endswith('.gz'):
            gzip_file_path = os.path.join(daily_folder_path, file)

            domains = []
            with gzip.open(gzip_file_path, 'rt') as f:  # Open in text mode ('rt') for easier processing
                for line in f:
                    domains.extend(line.strip())

            return domains
