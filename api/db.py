import os
import json
import pulsar
from dotenv import load_dotenv
from multipledispatch import dispatch
from collections import namedtuple
from types import *
from flask import current_app

from astrapy.db import AstraDB, AstraDBCollection
from astrapy.ops import AstraDBOps

from langchain_community.embeddings.spacy_embeddings import SpacyEmbeddings
import spacy
nlp = spacy.load("en_core_web_md")

AstraDBTable = namedtuple('DBTable', ['companies'])

# https://github.com/datastax/astrapy?tab=readme-ov-file
class AstraDBClient:
  client = None
  streaming_client = None
  company_creation_producer = None
  companies_cdc_topic = 'persistent://leads/default/companies-cdc'

  def __init__(self):
    load_dotenv()

    api_endpoint = os.getenv("ASTRA_DB_API_ENDPOINT")
    token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")

    self.client = AstraDB(token=token, api_endpoint=api_endpoint)

    token2 = os.environ['PULSAR_STREAMING_API_TOKEN']
    service_url = os.environ['ASTRA_DB_STREAMING_URL']
    self.streaming_client = pulsar.Client(service_url,
                            use_tls=True,
                            authentication=pulsar.AuthenticationToken(token2))

    self.company_creation_producer = self.streaming_client.create_producer(
      self.companies_cdc_topic,
      # producer_name='test-producer',
      # access_mode: 'Shared'
    )
  
  def __del__(self):
    self.streaming_client.close()

  def stream_data(self, producer, data):
    return self.producer.send(data)

  def stream_company_data(self, data):
    return self.stream_data(self.company_creation_producer, data)

  def collections(self):
    return self.client.get_collections()
  
  def create_collection(self, name, dimension=5):
    return self.client.create_collection(collection_name=name, dimension=dimension)

  # Example Input
  # { name: "bruce", description: "his name is bruce" }
  # 
  # Example AstraDB Record output
  # {
  #     "_id": "5", # _id is auto-generated
  #     "name": "bruce",
  #     "description": "his name is bruce",
  #     "$vector": [0.25, 0.25, 0.25, 0.25, 0.25],
  # }
  def insert(self, collection, data):
    tmp_datastring = json.dumps(data)
    vector_embedding = nlp(tmp_datastring)
    current_app.logger.info('Vector embedding created for company record')
    data['$vector'] =  [float(component) for component in vector_embedding.vector]

    datastring = json.dumps(data)
    collection = self.client.collection(collection_name=collection)
    return collection.insert_one(data)

  def insert_company(self, data):
    return self.insert("companies", data)

  def find_by_name(self, name):
    return self.client.find_one({"name": name})

  def find_by_attrs(self, attrs):
    return self.client.find_one(attrs)

  def find(id):
    return self.client.find_one({"_id": id})

  def search_by_name(name):
    return self.client.find_many({"name": name})
