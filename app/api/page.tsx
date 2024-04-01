'use client'

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Image from "next/image";

export default function API() {
  return (<>
    <Header />
  
    <main>
      <div className="py-16 bg-gradient-to-tr">  
        <div className="container m-auto px-6 text-gray-600 md:px-12 xl:px-6 text-center">
            <h1 className="text-2xl text-gray-900 font-bold md:text-4xl">Leads API</h1>
            <p className="mt-6 text-gray-600">LeadsDB is available as an API interface.</p>
            <p className="mt-4 text-gray-600">Pay as you go with our flexible pricing plan.</p>
        </div>
        <section className="py-6 dark:bg-gray-100 dark:text-gray-800">
          <div className="container p-4 mx-auto sm:p-10">
            <div className="mb-12 space-y-4 text-center">
              <h1 className="text-4xl font-semibold leading-tight">Pricing</h1>
              <p className="px-4 sm:px-8 lg:px-24">Start for free and upgrade to flexible pricing when you're ready.</p>
              <div>
                <button className="px-4 py-1 font-semibold border rounded-l-lg dark:bg-violet-600 dark:border-violet-600 dark:text-gray-50">Monthly</button>
                <button className="px-4 py-1 border rounded-r-lg dark:border-violet-600">Annually</button>
              </div>
            </div>
            <div className="grid max-w-md grid-cols-1 gap-6 mx-auto auto-rows-fr lg:grid-cols-3 lg:max-w-full">
              <div className="flex flex-col overflow-hidden border-2 rounded-md dark:border-gray-300">
                <div className="flex flex-col items-center justify-center px-2 py-8 space-y-4 dark:bg-gray-100">
                  <p className="text-lg font-medium">Starter</p>
                  <p className="text-5xl font-bold">$0
                    <span className="text-xl dark:text-gray-600">/mo</span>
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center px-2 py-8 dark:bg-gray-50">
                  <ul className="self-stretch flex-1 space-y-2">
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Receive Leads by email</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>1000 Test Requests per month</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>1 Team Member per month</span>
                    </li>
                  </ul>
                  <button className="px-8 py-3 mt-6 text-lg font-semibold rounded sm:mt-12 dark:bg-violet-600 dark:text-gray-50">Sign up</button>
                </div>
              </div>
              <div className="flex flex-col overflow-hidden border-2 rounded-md dark:border-violet-600">
                <div className="flex flex-col items-center justify-center px-2 py-8 space-y-4 dark:bg-gray-100">
                  <p className="text-lg font-medium">Pro</p>
                  <p className="text-5xl font-bold">8
                    <span className="text-xl dark:text-gray-600">/mo</span>
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center px-2 py-8 dark:bg-gray-50">
                  <ul className="self-stretch flex-1 space-y-2">
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                  </ul>
                  <button className="px-8 py-3 mt-6 text-lg font-semibold rounded sm:mt-12 dark:bg-violet-600 dark:text-gray-50">Sign up</button>
                </div>
              </div>
              <div className="flex flex-col overflow-hidden border-2 rounded-md dark:border-gray-300">
                <div className="flex flex-col items-center justify-center px-2 py-8 space-y-4 dark:bg-gray-100">
                  <p className="text-lg font-medium">Enterprise</p>
                  <p className="text-5xl font-bold">19€
                    <span className="text-xl dark:text-gray-600">/mo</span>
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center px-2 py-8 dark:bg-gray-50">
                  <ul className="self-stretch flex-1 space-y-2">
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                    <li className="flex justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 dark:text-violet-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                      <span>Lumet consectetur adipisicing</span>
                    </li>
                  </ul>
                  <button className="px-8 py-3 mt-6 text-lg font-semibold rounded sm:mt-12 dark:bg-violet-600 dark:text-gray-50">Sign up</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <Footer />
  </>)
}
