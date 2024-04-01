'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useSnackbar } from 'notistack';
import { FormEvent } from 'react';
import { Card, Pane } from 'evergreen-ui';

import { Cog8ToothIcon, MagnifyingGlassIcon, GlobeAltIcon, EnvelopeIcon } from '@heroicons/react/24/solid'
import staticData from '@/utils/staticData';
import PrivacyPolicy from '@/components/PrivacyPolicy';
import CookiePolicy from '@/components/CookiePolicy';
import TermsAndConditions from '@/components/TermsAndConditions';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState<string>('')
  const [country, setCountry] = useState<string>('United States')
  const [industries, setIndustries] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('');
  const [qualifications, setQualifications] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = {
      email: email,
      country: country ?? 'US',
      industries: industries ?? [],
      qualifications: qualifications ?? '',
    };

    try {
      const response = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        enqueueSnackbar('Form submitted successfully!', { variant: 'success' });


        // Reset form fields
        setEmail('');
        setCountry('United States');
        setIndustries([]);
      } else {
        console.error('Error:', response.statusText);
        enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
      }
    } catch (error) {
      console.error('Error:', error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
  }

  const Banner = () => (<>
    <div className="px-4 py-16 mx-auto sm:max-w-xl md:max-w-full lg:max-w-screen-xl md:px-24 lg:px-8 lg:py-20">
      <div className="max-w-xl mb-10 md:mx-auto sm:text-center lg:max-w-2xl md:mb-12">
        <div>
          <p className="inline-block px-3 py-px mb-4 text-xs font-semibold tracking-wider text-teal-900 uppercase rounded-full bg-teal-accent-400">
            Brand new
          </p>
        </div>
        <h2 className="max-w-lg mb-6 font-sans text-3xl font-bold leading-none tracking-tight text-gray-900 sm:text-4xl md:mx-auto">
          <span className="relative inline-block">
            <svg
                viewBox="0 0 52 24"
                fill="currentColor"
                className="absolute top-0 left-0 z-0 hidden w-32 -mt-8 -ml-20 text-blue-gray-100 lg:w-32 lg:-ml-28 lg:-mt-10 sm:block"
              >
                <defs>
                  <pattern
                    id="ea469ae8-e6ec-4aca-8875-fc402da4d16e"
                    x="0"
                    y="0"
                    width=".135"
                    height=".30"
                  >
                    <circle cx="1" cy="1" r=".7" />
                  </pattern>
                </defs>
                <rect
                  fill="url(#ea469ae8-e6ec-4aca-8875-fc402da4d16e)"
                  width="52"
                  height="24"
                />
              </svg>
            <span className="relative">Grow Your Business with Quality Leads</span>
          </span>
        </h2>
        <p className="text-base text-gray-700 md:text-lg">
        Expand your outreach with curated contact lists tailored to your industry preferences.
        </p>
      </div>
      <div className="grid gap-8 row-gap-10 lg:grid-cols-2">
        <div className="max-w-md sm:mx-auto sm:text-center">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50 sm:mx-auto sm:w-24 sm:h-24">
            <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />
          </div>
          <h6 className="mb-3 text-xl font-bold leading-5">Discover new targeted leads</h6>
          <p className="mb-3 text-sm text-gray-900">
            Unlock the potential of your sales strategy with access to targeted leads in your preferred industry. Our database is constantly updated to bring you the most relevant contacts.
          </p>
        </div>
        <div className="max-w-md sm:mx-auto sm:text-center">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50 sm:mx-auto sm:w-24 sm:h-24">
            <Cog8ToothIcon className="h-6 w-6 text-blue-500" />
          </div>
          <h6 className="mb-3 text-xl font-bold leading-5">Customized Selection</h6>
          <p className="mb-3 text-sm text-gray-900">
            Searching for new sales leads, networking contacts, or potential partners? Filter leads by location, industry, and job title to build a list that aligns perfectly with your business goals.
          </p>
        </div>
        <div className="max-w-md sm:mx-auto sm:text-center">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50 sm:mx-auto sm:w-24 sm:h-24">
            <GlobeAltIcon className="h-6 w-6 text-blue-500" />
          </div>
          <h6 className="mb-3 text-xl font-bold leading-5">Organically grow</h6>
          <p className="mb-3 text-sm text-gray-900">
            Benefit from a database that's regularly refreshed, ensuring you have the latest information at your fingertips.
          </p>
        </div>
        <div className="max-w-md sm:mx-auto sm:text-center">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50 sm:mx-auto sm:w-24 sm:h-24">
            <EnvelopeIcon className="h-6 w-6 text-blue-500" />
          </div>
          <h6 className="mb-3 text-xl font-bold leading-5">
            Straight To Your Inbox
          </h6>
          <p className="mb-3 text-sm text-gray-900">
            Receive Leads directly in your email inbox every week, with detailed company info.
          </p>
        </div>
      </div>
    </div>
  </>);

  return (
    <>
      <Header />

      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <Card>
          <Banner />
        </Card>

        <Pane className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          <Pane className="text-center mb-3">
            <h1 className="mt-0 text-4xl font-bold mb-4">Ready to start?</h1>
            <Pane elevation={2} paddingX={30} className="bg-white w-full max-w-full flex items-center justify-center">
              <form onSubmit={handleSubmit} className="w-full max-w-full mg-auto mb-8">
                <Pane className="flex flex-wrap -mx-3 mb-6">
                  <div className="w-full px-3 mt-6">
                  <label htmlFor="email" className="block text-gray-700 font-bold mb-2">
                    Email
                  </label>
                  <input
                    required
                    value={email}
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg shadow-sm border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                </Pane>
                
                <Pane className="flex flex-wrap -mx-3 mb-6">
                  <div className="w-full px-3 mt-6">
                  <label htmlFor="email" className="block text-gray-700 font-bold mb-2">
                    Tell us your lead preferences: locations, job title(s), qualifications, or anything else
                  </label>
                  <input
                    id="title"
                    type="text"
                    placeholder="Enter your preferred titles or qualifications"
                    onChange={(e) => setQualifications(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg shadow-sm border-2 border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                </Pane>

                <Pane className="flex flex-wrap -mx-3 mb-6">
                  <div className="w-full px-3">
                    <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="country">
                      Target Country
                    </label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="block w-full p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    >
                      {staticData.countries.map(
                        country => <option key={country}>{country}</option> )}
                    </select>
                  </div>
                </Pane>

                <Pane className="w-full max-h-96 rounded-lg overflow-y-auto px-4 py-2 bg-white">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                    Target Industries
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search industries..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 mb-4 text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <img
                      src="/search-icon.png"
                      alt="Search"
                      className="absolute top-2 left-3 h-5 w-5"
                    />
                  </div>
                  <Pane className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {staticData.industries.filter(industry =>
                      !searchQuery || industry.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(industry => (
                      <div key={industry} className="flex items-center">
                        <input
                          id={industry}
                          type="checkbox"
                          value={industry}
                          className="form-checkbox h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-2"
                          checked={industries.includes(industry)}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIndustries(prevIndustries =>
                              checked
                                ? [...prevIndustries, industry]
                                : prevIndustries.filter(i => i !== industry)
                            );
                          }}
                        />
                        <label
                          htmlFor={industry}
                          className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                        >
                          {industry}
                        </label>
                      </div>
                    ))}
                  </Pane>
                </Pane>

                <Pane className="mt-6">
                  <button
                    type="submit"
                    className="w-full py-3 px-6 bg-blue-500 text-white font-bold rounded-md shadow-md hover:bg-blue-600 transition duration-300"
                  >
                    Get Leads Today
                  </button>
                </Pane>
              </form>
            </Pane>
          </Pane>
        </Pane>
      </main>

      <Footer />
    </>
  )
}
