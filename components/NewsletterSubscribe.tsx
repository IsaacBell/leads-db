import { useState } from 'react'
import { classNames } from '@/utils/helpers'
import { FormEvent } from 'react';

interface NewsletterSubscribeProps {
  setSubscribed: (subscribed: boolean) => void;
}

function NewsletterSubscribe({ setSubscribed = (_subscribed: boolean) => {} }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState('')
  const [clicked, setClicked] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setClicked(true)
    await fetch('api/v1/subscribe', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })
    setSubscribed(true)
  }

  return (
    <form
      className="font-secondary flex flex-shrink w-full px-2 max-w-lg mx-auto justify-center"
      onSubmit={handleSubmit}
    >
      <input 
        className="placeholder:italic placeholder:text-slate-400 block bg-white w-full border border-slate-300 rounded-md py-2 pl-9 pr-3 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:ring-1 sm:text-sm" 
        type="email"
        required
        placeholder="Your email here"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        className={classNames(
          clicked ? 'pointer-events-none	opacity-75' : '',
          `py-3 px-4 bg-palette-primary hover:bg-palette-dark text-black text-sm sm:text-base font-semibold rounded-r-lg border border-transparent 
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-palette-primary
          bg-slate-100
          `
        )}
      >
        Subscribe
      </button>
    </form>
  )
}

export default NewsletterSubscribe
