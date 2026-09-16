from leadsdb_engine.logging.sentry import Sentry
from logging import getLogger, Logger

# existing logging setup
# # These logs will be automatically sent to Sentry
class Log:
		logger: Logger | None = None
		sdk: Sentry | None = None

		def __init__(self) -> None:
			logger = getLogger(__name__)
			sdk = Sentry()
