import { Product, WithContext } from 'schema-dts'
import type { Graph } from 'schema-dts';

const jsonLd: WithContext<Product> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'LeadsDB',
  image: 'https://nextjs.org/imgs/sticker.png',
  description: '',
}

/* Example
const graph: Graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': 'https://my.site/#alyssa',
      name: 'Alyssa P. Hacker',
      hasOccupation: {
        '@type': 'Occupation',
        name: 'LISP Hacker',
        qualifications: 'Knows LISP',
      },
      mainEntityOfPage: {'@id': 'https://my.site/about/#page'},
      subjectOf: {'@id': 'https://my.site/about/#page'},
    },
    {
      '@type': 'AboutPage',
      '@id': 'https://my.site/#site',
      url: 'https://my.site',
      name: "Alyssa P. Hacker's Website",
      inLanguage: 'en-US',
      description: 'The personal website of LISP legend Alyssa P. Hacker',
      mainEntity: {'@id': 'https://my.site/#alyssa'},
    },
    {
      '@type': 'WebPage',
      '@id': 'https://my.site/about/#page',
      url: 'https://my.site/about/',
      name: "About | Alyssa P. Hacker's Website",
      inLanguage: 'en-US',
      isPartOf: {
        '@id': 'https://my.site/#site',
      },
      about: {'@id': 'https://my.site/#alyssa'},
      mainEntity: {'@id': 'https://my.site/#alyssa'},
    },
  ],
};
*/

const jsonLdGraph = (): Graph => ({
	'@context': 'https://schema.org',
  '@graph': []
});


const jsonLdToJSX = (jsonLd: any) => <script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
  }}
/>
