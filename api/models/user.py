from firebase_admin import firestore
from typing import Dict
from flask import current_app

class User:
    def __init__(self, data: Dict, id: str = None):
        self.id = id
        self.data = data
        if id:
            current_app.logger.info(f'User accessed: {id}')
        else:
            current_app.logger.info(f'User initialized: {self.data['email']}')

    def save(self):
        firestore_client = firestore.client()
        if self.id:
            doc_ref = firestore_client.collection('users').document(self.id)
            doc_ref.update(self.data)
        else:
            doc_ref = firestore_client.collection('users').document()
            doc_ref.set(self.data)
            self.id = doc_ref.id

    @staticmethod
    def get_by_id(user_id: str):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('users').document(user_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return User(data, doc.id)
        return None

    @staticmethod
    def get_by_email(email: str):
        firestore_client = firestore.client()
        query = firestore_client.collection('users').where('email', '==', email)
        docs = query.get()
        if docs:
            doc = docs[0]
            data = doc.to_dict()
            return User(data, doc.id)
        return None

    @staticmethod
    def get_all():
        firestore_client = firestore.client()
        docs = firestore_client.collection('users').get()
        users = []
        for doc in docs:
            data = doc.to_dict()
            user = User(data, doc.id)
            users.append(user)
        return users

    def update(self):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('users').document(self.id)
        doc_ref.update(self.data)

    def delete(self):
        firestore_client = firestore.client()
        doc_ref = firestore_client.collection('users').document(self.id)
        doc_ref.delete()
