import sentry_sdk

class Sentry:
		def __init__(self) -> None:
			sentry_sdk.init(
		    dsn="https://9bcdfca4cd5a2f0f92106495d382c33e@o4512013555662848.ingest.us.sentry.io/4512013573357568",
		    # Add data like request headers and IP for users,
		    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
		    send_default_pii=False,
		    # Enable sending logs to Sentry
		    enable_logs=True,
		    # 1.0 = 100% tracing/sampling
		    traces_sample_rate=1.0,
		    # 1.0 = 100% session profiling
		    profile_session_sample_rate=1.0,
			)
			sentry_sdk.logger.error('This is an error message')


		def count_metrics(self, name_: str, incr_: int | float):
			sentry_sdk.metrics.count(name_, incr_)

		def gauge_metrics(self, name_: str, incr_: int | float):
			sentry_sdk.metrics.gauge(name_, incr_)

		def distribution_metrics(self, name_: str, incr_: int | float):
			sentry_sdk.metrics.distribution(name_, incr_)

		def start_profiler(self):
				sentry_sdk.profiler.start_profiler()

		# optional - if you don't stop the profiler, it will keep profiling
		# until the process exits or stop_profiler is called.
		def stop_profiler(self):
				sentry_sdk.profiler.stop_profiler()
