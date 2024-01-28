import { Company } from '@/types';
import { AstraDB, Collection } from '@datastax/astra-db-ts'

const auth = {
  astraEndpoint: process.env.ASTRA_DB_API_ENDPOINT,
  // astraDatabaseId: process.env.ASTRA_DB_ID,
  // astraDatabaseRegion: process.env.ASTRA_DB_REGION,
  applicationToken: process.env.ASTRA_DB_APPLICATION_TOKEN,
};

export const astraClient = new AstraDB(auth.applicationToken, auth.astraEndpoint)

export const keyspace = () =>  astraClient.keyspaceName;

export const insert = (
  collectionName: string,
  data: Company | {}
) => astraClient.collection(collectionName).then(
  (collection: Collection) => collection.insertOne({...data}).then(response => {
      console.log({response});
      return response;
  }));


export const insertCompany = (data: Company) => insert('companies', data);
