import { useSearchParams } from 'react-router-dom'
import { PropertyListingPage } from './PropertyListingPage'

export function LouerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  return <PropertyListingPage searchParams={searchParams} setSearchParams={setSearchParams} mode="rent" />
}
