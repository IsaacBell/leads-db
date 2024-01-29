import os
import json
import pulsar
from dotenv import load_dotenv
from multipledispatch import dispatch
from collections import namedtuple
from types import *

from astrapy.db import AstraDB, AstraDBCollection
from astrapy.ops import AstraDBOps

from langchain_community.embeddings.spacy_embeddings import SpacyEmbeddings
import spacy


AstraDBTable = namedtuple('DBTable', ['companies'])

# https://github.com/datastax/astrapy?tab=readme-ov-file
class AstraDBClient:
  client = None
  streaming_client = None
  company_creation_producer = None
  embedder = SpacyEmbeddings()

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

    print("\n\n\n\n\n")
    print('self.streaming_client')
    print(self.streaming_client)
    # try:
    # consumer = self.streaming_client.subscribe('my-topic', 'my-subscription')

    self.company_creation_producer = self.streaming_client.create_producer(
      'persistent://leads/default/companies-cdc',
      # producer_name='test-producer',
      # access_mode: 'Shared'
    )
    # except Exception as e: print(e)

    for i in range(10):
      producer.send(('Hello World! %d' % i).encode('utf-8'))
  
  def __del__(self):
    self.streaming_client.close()

  def stream_data(producer, data):
    return producer.send(data)

  def stream_company_data(data):
    return stream_data(company_creation_producer, data)

  def collections(self):
    return self.client.get_collections()
  
  def create_collection(self, name, dimension=5):
    return self.client.create_collection(collection_name=name, dimension=dimension)

  # Example Input
  # { name: "bruce", description: "his name is bruce" }
  # 
  # Example AstraDB Record output
  # {
  #     "_id": "5",
  #     "name": "bruce",
  #     "description": "his name is bruce",
  #     "$vector": [0.25, 0.25, 0.25, 0.25, 0.25],
  # }
  def insert(self, data):
    tmp_datastring = json.dumps(data)
    vector_embedding = embedder.embed_query(tmp_datastring)
    data['$vector'] =  [float(component) for component in vector_embedding]

    datastring = json.dumps(data)
    return self.client.insert_one(data)

  def insert_company(data):
    return insert(data)

  def find_by_name(name):
    return self.client.find_one({"name": name})

  def find_by_attrs(attrs):
    return self.client.find_one(attrs)

  def find(id):
    return self.client.find_one({"_id": id})

  def search_by_name(name):
    return self.client.find_many({"name": name})
