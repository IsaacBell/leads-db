import os
from pinecone import Pinecone, ServerlessSpec

class Pinecone:
  client = None

  def __init__(self):
    client = client()

  def existing_indexes():
    return [ index_info["name"] for index_info in pc.list_indexes() ]

  def create_index(name, size):
    client.create_index(
      name=name,
      dimension=1536,
      metric="cosine",
      spec=ServerlessSpec(
        cloud="aws",
        region="us-west-2"
      )
    )
    while not client.describe_index(name).status['ready']:
      time.sleep(1)
  
  # example vector
  # {
  #   "id": "Grease", 
  #   "values": [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 
  #   "metadata": {"genre": "comedy", "year": 2020}
  # }
  def upsert(idx, data):
    if idx not in existing_indexes:
      create_index(idx)
    index = client.Index(idx)
    return index.upsert(vectors=data, namespace="main")

  def query(idx, data, filter={}, n = 10):
    index = client.Index(idx)
    return index.query(
      vector=data,
      filter=filter,
      top_k=n,
      include_metadata=True
    )
  
  def delete_index(idx):
    client.delete_index(idx)

  def client():
    pc = Pinecone()

    return pc
