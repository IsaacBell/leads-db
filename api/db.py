import os
import json
from dotenv import load_dotenv
from multipledispatch import dispatch
from collections import namedtuple
from types import *

from astrapy.db import AstraDB, AstraDBCollection
from astrapy.ops import AstraDBOps

from langchain_community.embeddings.spacy_embeddings import SpacyEmbeddings

AstraDBTable = namedtuple('DBTable', ['companies'])

# https://github.com/datastax/astrapy?tab=readme-ov-file
class AstraDBClient:
  client = None
  embedder = SpacyEmbeddings()

  def __init__():
    load_dotenv()

    token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
    api_endpoint = os.getenv("ASTRA_DB_API_ENDPOINT")

    client = AstraDB(token=token, api_endpoint=api_endpoint)
  
  def collections():
    return client.get_collections()
  
  def create_collection(name, dimension=5):
    return client.create_collection(collection_name=name, dimension=dimension)

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
  def insert(data):
    vector_embedding = embedder.embed_query(data)
    data['$vector'] =  [float(component) for component in vector_embedding]
    data_to_str = json.dumps(data)
    return client.insert_one(data)

  def insert_company(data):
    return insert(data)

  def find_by_name(name):
    return client.find_one({"name": name})

  def find_by_attrs(attrs):
    return client.find_one(attrs)

  def find(id):
    return client.find_one({"_id": id})

  def search_by_name(name):
    return client.find_many({"name": name})
