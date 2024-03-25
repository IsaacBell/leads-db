FROM python:3.12.1
#RUN apt update -y && apt install nodejs npm -y 
RUN curl -sL https://deb.nodesource.com/setup_21.x -o nodesource_setup.sh
RUN ["sh",  "./nodesource_setup.sh"]
RUN apt-get install nodejs -y
WORKDIR app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pip install spacy
RUN python -m spacy download en_core_web_md
RUN pip install -r requirements.txt
CMD ["pnpm","run","dev"]
