import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json',
        Authorization: `Bearer ${process.env.NOTION_TOKEN ?? ''}`,
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: "\"authorization_code\""
      })
    });

    const token = auth?.json().then(res => res.access_token);

    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json',
        Authorization: `Bearer ${process.env.NOTION_TOKEN ?? ''}`,
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: `${process.env.NOTION_DB_ID ?? ''}` },
        properties: {
          Email: {
            title: [
              {
                text: {
                  content: `${req.body.email}`,
                },
              },
            ],
          },
        },
      }),
    })
  } catch (err) {
    console.log('Error', err)
  }

  res.status(200).json({ status: 'success' })
}
