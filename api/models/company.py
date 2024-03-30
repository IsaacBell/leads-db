from firebase_admin import firestore
from db import AstraDBClient
from typing import Dict
from flask import current_app

class Company:
    def __init__(self, data: Dict, raw_data: Dict = None, id: str = None):
        self.id = id
        self.data = data
        if id:
            current_app.logger.info(f'Company accessed: {id}')
        else:
            current_app.logger.info(f'Company initialized: {self.data['name'] or self.data['domain']}')

    def save(self):
        firestore_client = firestore.client()
        cassandraDB = AstraDBClient()
        if self.id:
            # Update existing company
            doc_ref = firestore_client.collection('companies').document(self.id)
            doc_ref.update(self.data)
        else:
            # Create new company
            doc_ref = firestore_client.collection('companies').document()
            doc_ref.set(self.data)
            self.id = doc_ref.id
        try:
          current_app.logger.info(f'Inserting company into Cassandra DB: {self.id}')
          cassandraDB.insert_company(self)
        except Exception as e:
          cassandraDB.insert_company(self.data) 

    @staticmethod
    def get_by_id(company_id: str):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('companies').document(company_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return Company(data['data'], doc.id)
        return None

    @staticmethod
    def get_by_name(name: str):
        firestore_client = firestore.client()
        query = firestore_client.collection('companies').where('data.name', '==', name)
        docs = query.get()
        if docs:
            doc = docs[0]
            data = doc.to_dict()
            return Company(data['data'], doc.id)
        return None

    @staticmethod
    def get_all():
        firestore_client = firestore.client()
        docs = firestore_client.collection('companies').get()
        companies = []
        for doc in docs:
            data = doc.to_dict()
            company = Company(data['data'], doc.id)
            companies.append(company)
        return companies

    def update(self):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('companies').document(self.id)
        doc_ref.update({
            'data': self.data
        })

    def delete(self):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('companies').document(self.id)
        doc_ref.delete()