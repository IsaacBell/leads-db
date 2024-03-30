import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from urllib.parse import urljoin

# placeholder - will replace
class SiteSummarizer:
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)

    def scrape_and_summarize(self, url, visited=None):
        if visited is None:
            visited = set()

        # Check if the URL has already been visited
        if url in visited:
            return None
        visited.add(url)

        # Scrape the HTML site
        response = requests.get(url)
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract relevant text content
        text = ""
        for paragraph in soup.find_all("p"):
            text += paragraph.get_text() + "\n"

        # Clean and preprocess the text
        text = text.strip()
        print(text)

        # Generate a summary using GPT-4
        prompt = f"Please summarize the following text:\n\n{text}"
        summary = ""
        try:
            response = self.client.chat.completions.create(
              model="gpt-3.5",
              messages=[{"role": "user", "content": prompt}],
              max_tokens=100,
              n=1,
              stop=None,
              temperature=0.7,
              request_timeout=15
            )
            summary = response.choices[0].message.content.strip()
        except openai.error.Timeout as e:
          #Handle timeout error, e.g. retry or log
          print(f"OpenAI API request timed out: {e}")
          pass
        except openai.error.APIError as e:
          #Handle API error, e.g. retry or log
          print(f"OpenAI API returned an API Error: {e}")
          pass
        except openai.error.APIConnectionError as e:
          #Handle connection error, e.g. check network or log
          print(f"OpenAI API request failed to connect: {e}")
          pass
        except openai.error.InvalidRequestError as e:
          #Handle invalid request error, e.g. validate parameters or log
          print(f"OpenAI API request was invalid: {e}")
          pass
        except openai.error.AuthenticationError as e:
          #Handle authentication error, e.g. check credentials or log
          print(f"OpenAI API request was not authorized: {e}")
          pass
        except openai.error.PermissionError as e:
          #Handle permission error, e.g. check scope or log
          print(f"OpenAI API request was not permitted: {e}")
          pass
        except openai.error.RateLimitError as e:
          #Handle rate limit error, e.g. wait or log
          print(f"OpenAI API request exceeded rate limit: {e}")
          pass


        # Find and follow internal links
        summaries = []
        for link in soup.find_all("a"):
            href = link.get("href")
            if href and not href.startswith("http"):
                # Convert relative URL to absolute URL
                internal_url = urljoin(url, href)
                internal_summary = self.scrape_and_summarize(internal_url, visited)
                if internal_summary:
                    summaries.append(internal_summary)
        
        return {"url": url, "summary": summary, "internal_summaries": summaries}
