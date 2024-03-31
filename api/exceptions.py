class AuthException(Exception):
  pass

class FirebaseException(Exception):
    pass

def raise_auth_exception():
  raise AuthException('Unable to authorize user. Please review your credentials.')

def raise_firebase_credentials_committed_exception():
  raise FirebaseException('Credential file has been checked into source control. Remove this from the history immediately.')
