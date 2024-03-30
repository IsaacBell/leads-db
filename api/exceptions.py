class FirebaseException(Exception):
    pass

def raise_firebase_credentials_committed_exception():
  raise FirebaseException('Credential file has been checked into source control. Remove this from the history immediately.')
