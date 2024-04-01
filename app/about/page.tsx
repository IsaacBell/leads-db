'use client'

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Image from "next/image";

export default function About() {
  return (<>
    <Header />
  
    <main>
      <div className="py-16 bg-gradient-to-tr">  
        <div className="container m-auto px-6 text-gray-600 md:px-12 xl:px-6">
            <div className="space-y-6 md:space-y-0 md:flex md:gap-6 lg:items-center lg:gap-12">
              <div className="md:5/12 lg:w-5/12">
                {/* <img src="https://tailus.io/sources/blocks/left-image/preview/images/startup.png" alt="image" loading="lazy" width="" height=""> */}
                <Image 
                  priority 
                  src="/Soapstone-Logo-2.png" 
                  alt="Soapstone Logo" 
                  width={300} 
                  height={300} 
                />
              </div>
              <div className="md:7/12 lg:w-6/12">
                <h2 className="text-2xl text-gray-900 font-bold md:text-4xl">LeadsDB is built by passionate creators.</h2>
                <p className="mt-6 text-gray-600">Headquarted in New York City, Soapstone Solutions is a globally distributed collective of tech and business professionals. We love what we do.</p>
                <p className="mt-4 text-gray-600">We build tools to serve emerging industries and high-growth companies.</p>
              </div>
            </div>
        </div>
      </div>
    </main>

    <Footer />
  </>)
}
