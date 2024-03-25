import os
import json
from kafka import KafkaProducer

class KafkaMessageProducer:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=os.getenv('KAFKA_URL', None),
            sasl_mechanism='SCRAM-SHA-256',
            security_protocol='SASL_SSL',
            sasl_plain_username=os.getenv('KAFKA_USERNAME', ''),
            sasl_plain_password=os.getenv('KAFKA_PASSWORD', ''),
            api_version_auto_timeout_ms=3000,  
            request_timeout_ms=3000  
        )
        

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.producer.close()

    def produce_message(self, topic, message, logger = None):
        try:
            result = self.producer.send(topic, json.dumps(message).encode('utf-8'))
            if logger:
                logger.info("Message produced: %s", result)
            return result
        except Exception as e:
            print(f"Error producing message: {e}")

