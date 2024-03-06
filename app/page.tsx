'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import staticData from '@/utils/staticData'

export default function Home() {
  const [email, setEmail] = useState<string>('')
  const [country, setCountry] = useState<string>('')
  const [industries, setIndustries] = useState<string[]>([])

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          country: country ?? 'US',
          industries: industries ?? [],
        }),
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log(data); // Handle the response data as needed
        // Reset form fields
        setEmail('');
        setCountry('');
        setIndustries([]);
      } else {
        console.error('Error:', response.statusText);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">LeadsDB</h1>
            <p className="text-lg text-gray-600">
              Searching for new leads? Enter your target search parameters and receive weekly updates directly to your email.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <div className="flex flex-wrap -mx-3 mb-6">
              <div className="w-full px-3">
                <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  required
                  value={email}
                  id="email"
                  type="email"
                  placeholder="Email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none bg-white block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-6">
              <div className="w-full px-3">
                <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="country">
                  Target Country
                </label>
                <select
                  id="country"
                  className="block w-full p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  value={country}
                >
                  {staticData.countries.map(country => <option key={country} value={country}>{country}</option> )}
                </select>
              </div>
            </div>
            <div className="w-full flex flex-wrap -mx-3 mb-6">
              <div className="ml-0 w-full px-3">
                <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                  Target Industries
                </label>
                <div className="w-full flex items-center mb-4">
                  <div className="w-full flex flex-wrap">
                    <div className="w-full h-40 overflow-y-auto">
                      {staticData.industries.map(industry => (
                        <div key={industry} className="w-full flex items-center mb-2">
                          <input
                            id={industry}
                            type="checkbox"
                            value={industry}
                            checked={industries.includes(industry)}
                            onChange={e => {
                              const checked = e.target.checked;
                              setIndustries(prevIndustries =>
                                checked
                                  ? [...prevIndustries, industry]
                                  : prevIndustries.filter(i => i !== industry)
                              );
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <label
                            htmlFor={industry}
                            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                          >
                            {industry}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center mb-4"></div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap -mx-3 mb-6">
              <div className="w-full px-3">
                <button
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  type="submit"
                >
                  Submit
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}